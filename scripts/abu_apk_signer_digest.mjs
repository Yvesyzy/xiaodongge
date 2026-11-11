#!/usr/bin/env node
// Prints the SHA-256 digest of the first signer certificate from an APK's v2/v3
// signing block. Needed because this machine's Android build-tools ship
// apksigner.bat without lib/apksigner.jar, so `apksigner verify --print-certs`
// cannot run. Output matches apksigner's "certificate SHA-256 digest".
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const APK_SIG_BLOCK_MAGIC = Buffer.from("APK Sig Block 42");
const V2_BLOCK_ID = 0x7109871a;
const V3_BLOCK_ID = 0xf05368c0;

function u32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}
function u64(buffer, offset) {
  return Number(buffer.readBigUInt64LE(offset));
}

function firstCertificate(valueStart, buffer) {
  const signersLength = u32(buffer, valueStart);
  if (signersLength <= 0) throw new Error("empty signer sequence");
  const signerLength = u32(buffer, valueStart + 4);
  const signerStart = valueStart + 8;
  const signedDataLength = u32(buffer, signerStart);
  if (signedDataLength <= 0 || signedDataLength > signerLength) throw new Error("bad signed-data length");
  const signedDataStart = signerStart + 4;
  const digestsLength = u32(buffer, signedDataStart);
  const certificatesLengthOffset = signedDataStart + 4 + digestsLength;
  if (certificatesLengthOffset + 4 > signerStart + signerLength) throw new Error("bad certificate sequence offset");
  const certificatesLength = u32(buffer, certificatesLengthOffset);
  if (certificatesLength <= 0) throw new Error("missing certificate");
  const certificateLength = u32(buffer, certificatesLengthOffset + 4);
  const certificateStart = certificatesLengthOffset + 8;
  if (certificateStart + certificateLength > buffer.length) throw new Error("truncated certificate");
  return buffer.subarray(certificateStart, certificateStart + certificateLength);
}

function findBlock(buffer, blockId) {
  const magicOffset = buffer.lastIndexOf(APK_SIG_BLOCK_MAGIC);
  if (magicOffset < 0) throw new Error("APK signing block not found");
  const sizeAtEnd = u64(buffer, magicOffset - 8);
  const blockStart = magicOffset + APK_SIG_BLOCK_MAGIC.length - (sizeAtEnd + 8);
  if (blockStart < 0) throw new Error("corrupt signing block size");
  const pairsStart = blockStart + 8;
  let offset = pairsStart;
  while (offset < magicOffset - 8) {
    const pairLength = u64(buffer, offset);
    if (pairLength < 4) throw new Error("corrupt signing block entry");
    const id = u32(buffer, offset + 8);
    if (id === blockId) return { valueStart: offset + 12, valueLength: pairLength - 4 };
    offset += 8 + pairLength;
  }
  return null;
}

const apkPath = process.argv[2];
if (!apkPath) {
  console.error("usage: node scripts/abu_apk_signer_digest.mjs <apk>");
  process.exit(2);
}
const buffer = readFileSync(apkPath);
for (const [label, id] of [["v3", V3_BLOCK_ID], ["v2", V2_BLOCK_ID]]) {
  const block = findBlock(buffer, id);
  if (!block) continue;
  const certificate = firstCertificate(block.valueStart, buffer);
  if (certificate[0] !== 0x30) throw new Error(`${label} certificate is not a DER SEQUENCE`);
  console.log(JSON.stringify({
    apk: apkPath,
    scheme: label,
    certificateBytes: certificate.length,
    certificateSha256: createHash("sha256").update(certificate).digest("hex"),
  }));
  process.exit(0);
}
throw new Error("APK has neither a v2 nor a v3 signing block");
