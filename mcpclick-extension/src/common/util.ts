export async function subtleDigest(alg: AlgorithmIdentifier, data: BufferSource) {
  return await crypto.subtle.digest(alg, data);
}


