const parseSearchQuery = (inputQuery) => {
    if (!inputQuery) return { scope: 'all', keyword: '' };
    
    const tagRegex = /^@(\w+)\s+(.*)/;
    const match = inputQuery.match(tagRegex);
  
    if (match) {
      return { scope: match[1].toLowerCase(), keyword: match[2].trim() };
    }
    return { scope: 'all', keyword: inputQuery.trim() };
  };
  
  module.exports = { parseSearchQuery };