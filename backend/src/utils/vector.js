// utils/vector.js
const floatArrayToBuffer = (arr) => {
    return Buffer.from(new Float32Array(arr).buffer);
  };
  
  const bufferToFloatArray = (buffer) => {
    return Array.from(new Float32Array(buffer.buffer));
  };
  
  const cosineSimilarity = (a, b) => {
    let dot = 0, normA = 0, normB = 0;
  
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
  
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };
  
  module.exports = { floatArrayToBuffer, bufferToFloatArray, cosineSimilarity };