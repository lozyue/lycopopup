// Node >= 14+ recommended
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Efficient line-by-line post-processor for .d.ts files produced by rollup-plugin-dts.
 *
 * - Removes top-level `export {}` lines.
 * - Removes leading `declare ` or `export declare ` prefixes.
 * - Wraps remaining content in `declare module "name" { ... }` and indents body lines.
 * - Preserves triple-slash references, top-of-file block comments, and `declare global {}` blocks.
 *
 * @param {string} filePath - path to .d.ts file
 * @param {{moduleName?: string, indent?: string}} opts
 */
async function postProcessDtsFile(filePath, opts = {}) {
  const indent = opts.indent ?? '  '; // two-space by default
  const moduleName = opts.moduleName ?? path.basename(filePath, '.d.ts');

  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch(err) {
    // file may not exist; bail quietly
    console.warn(`[postProcessDtsFile] could not read ${filePath}: ${err.message}`);
    return;
  }

  const lines = raw.split(/\r?\n/);
  const preamble = []; // lines to keep outside the module wrapper (references, top comments, declare global blocks...)
  const body = []; // lines to go inside the module wrapper

  // state flags for multi-line constructs
  let inBlockComment = false;
  let inDeclareGlobal = false;
  let declareGlobalDepth = 0;

  // helper: cheaply check prefix without regex heavy ops
  const startsWith = (str, prefix) => str.slice(0, prefix.length) === prefix;

  for(let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmedLeft = line.replace(/^\s+/, '');
    const trimmed = line.trim();

    // Track block comments (/* ... */), keep them in preamble if they start at top or before other code
    if(!inBlockComment && startsWith(trimmedLeft, '/*')) {
      inBlockComment = true;
      preamble.push(line);
      // if comment ends same line
      if(trimmedLeft.indexOf('*/') !== -1) {
        inBlockComment = false;
      }
      continue;
    } else if(inBlockComment) {
      preamble.push(line);
      if(trimmedLeft.indexOf('*/') !== -1) {
        inBlockComment = false;
      }
      continue;
    }

    // preserve triple-slash refs at top-level
    if(startsWith(trimmedLeft, '///')) {
      preamble.push(line);
      continue;
    }

    // preserve "export as namespace X;" at top-level
    if(startsWith(trimmedLeft, 'export as namespace')) {
      preamble.push(line);
      continue;
    }

    // handle declare global { ... } blocks: keep them as-is outside the wrapper
    if(!inDeclareGlobal && startsWith(trimmedLeft, 'declare global')) {
      inDeclareGlobal = true;
      // count braces to know when it ends
      declareGlobalDepth = (trimmedLeft.match(/{/g) || []).length - (trimmedLeft.match(/}/g) || []).length;
      preamble.push(line);
      // if block opened and closed same line, close immediately
      if(declareGlobalDepth <= 0 && trimmedLeft.indexOf('{') === -1) {
        inDeclareGlobal = false;
      }
      continue;
    } else if(inDeclareGlobal) {
      preamble.push(line);
      // update depth counts
      declareGlobalDepth += (line.match(/{/g) || []).length;
      declareGlobalDepth -= (line.match(/}/g) || []).length;
      if(declareGlobalDepth <= 0) inDeclareGlobal = false;
      continue;
    }

    // Skip empty lines at top of body (we keep some empties inside module though)
    // Remove trivial `export {}` (commonly emitted and harmful for path mapping)
    if(trimmed === 'export {}') {
      continue;
    }

    // Remove 'declare ' prefix at line start; replace 'export declare ' -> 'export '
    if(startsWith(trimmedLeft, 'export declare ')) {
      // preserve leading whitespace indentation
      const leadingWs = line.slice(0, line.indexOf(trimmedLeft));
      line = leadingWs + trimmedLeft.replace('export declare ', 'export ');
      body.push(line);
      continue;
    } else if(startsWith(trimmedLeft, 'declare ')) {
      const leadingWs = line.slice(0, line.indexOf(trimmedLeft));
      line = leadingWs + trimmedLeft.replace(/^declare\s+/, '');
      body.push(line);
      continue;
    }

    // default: push to body
    body.push(line);
  }

  // If body is empty, nothing to wrap — but still write back (maybe only preamble existed)
  let outParts = [];

  // Ensure preamble ends with a single newline separation
  if(preamble.length) {
    // trim trailing empty lines in preamble
    while(preamble.length && preamble[preamble.length - 1].trim() === '') {
      preamble.pop();
    }
    outParts.push(...preamble);
    outParts.push(''); // one blank line before module wrapper
  }

  // Build module wrapper
  outParts.push(`declare module "${moduleName}" {`);
  // indent body lines
  for(const ln of body) {
    // keep exact empties as blank lines with indentation removed to avoid extra spaces on blank lines
    if(ln.trim() === '') {
      outParts.push('');
    } else {
      outParts.push(indent + ln);
    }
  }
  outParts.push('}'); // close module
  outParts.push(''); // trailing newline

  const newContent = outParts.join('\n');

  // Write patched content back to file only if changed (avoid updating mtime unnecessarily)
  if(newContent !== raw) {
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`[postProcessDtsFile] patched ${filePath} (moduleName="${moduleName}")`);
  } else {
    console.log(`[postProcessDtsFile] no changes for ${filePath}`);
  }
}

/**
 * Helper: accept the rollup outputs array (each output object), find resulting .d.ts files
 * and process them. If an output has `file` that endsWith .d.ts -> process it.
 * If an output.targets a dir (output.dir), scan that directory for .d.ts and process all.
 */
export async function postProcessRollupOutputs(outputs, opts = {}) {
  const processed = new Set();
  for(const output of outputs) {
    // case: single file output
    if(output && typeof output.file === 'string' && output.file.endsWith('.d.ts')) {
      const fp = output.file;
      if(opts.moduleNameFilter) {
        const passed = opts.moduleNameFilter(fp);
        if(!passed) continue;
      }
      if(!processed.has(fp)) {
        await postProcessDtsFile(fp, { moduleName: opts.moduleNameFromOutput ? opts.moduleNameFromOutput(output) : undefined, indent: opts.indent });
        processed.add(fp);
      }
      continue;
    }

    // case: directory output -> scan for .d.ts
    if(output && typeof output.dir === 'string') {
      const dir = output.dir;
      try {
        const all = await fs.readdir(dir);
        for(const name of all) {
          if(name.endsWith('.d.ts')) {
            const fp = path.join(dir, name);
            if(!processed.has(fp)) {
              await postProcessDtsFile(fp, { moduleName: opts.moduleNameFromOutput ? opts.moduleNameFromOutput(output, name) : path.basename(name, '.d.ts'), indent: opts.indent });
              processed.add(fp);
            }
          }
        }
      } catch(err) {
        // ignore if dir not exist
      }
    }
  }
}
