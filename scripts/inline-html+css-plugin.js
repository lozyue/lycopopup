import { minify } from "html-minifier-terser";

const minifierOptions = { // See: https://www.npmjs.com/package/html-minifier-terser
  caseSensitive: true, // Don't add obscure attrs.
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true
};

/**
 * Rollup plugin for processing inline HTML and CSS 
 * Usage: 
 * - Inline html \/*@plugin-html*\/`<inline-html></inline-html>`
 * - inline css \/*@plugin-css*\/`.inline-style{}`
 */
export function rollupInlineTemplate(ctx = {}) {
  const {
    isProduction = true
  } = ctx;

  return {
    name: 'rollup-inline-html-css-minifier',
    async transform(code, id) {
      if (!/\.(js|ts)$/.test(id) || !isProduction) {
        return null; // Rollup expects null when no transformation is needed
      }

      let modified = false;
      let result = code;

      // Process inline HTML
      if (code.includes('/*@plugin-html*/')) {
        console.log("Matched inline-html:" + id);
        result = await processInlineContent(result, /\/\*@plugin-html\*\/\s*`([\s\S]*?)`/g, async (content) => {
          return await minify(content, minifierOptions);
        });
        modified = true;
      }
      
      // Process inline CSS
      if (code.includes('/*@plugin-css*/')) {
        result = await processInlineContent(result, /\/\*@plugin-css\*\/\s*`([\s\S]*?)`/g, async (content) => {
          return (await minify(`<style>${content}</style>`, minifierOptions))
            .replace('<style>', '')
            .replace('</style>', '');
        });
        modified = true;
      }
      
      // Rollup expects { code, map } object when transformation occurs
      return modified ? { code: result, map: null } : null;
    }
  };
}

// Helper function for processing inline content
async function processInlineContent(code, regex, processFn) {
  const matches = code.matchAll(regex);
  let result = code;
  
  for (const match of matches) {
    const [fullMatch, content] = match;
    const processed = await processFn(content);
    result = result.replace(fullMatch, fullMatch.replace(content, processed));
  }
  
  return result;
}