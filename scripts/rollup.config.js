// rollup.config.js
import { readdirSync } from 'fs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

import { getPrettyTime, camelCase, getCommandArguments } from "./sharer-es.js"; 
import { rollupInlineTemplate } from './inline-html+css-plugin.js';

const argvs = getCommandArguments();
const entryFiles = readdirSync('src/indexes', { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => `src/indexes/${entry.name}`);

function footerPlugin(setting) {
  return {
    name: 'lyco-footer',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        const name = item.fileName || '';
        const footer = name.endsWith('.d.ts')
          ? setting.dts
          : name.endsWith('.css')
            ? setting.css
            : setting.js;

        if (!footer) continue;

        if (item.type === 'chunk') {
          item.code = `${item.code}\n${footer}`;
        } else if (typeof item.source === 'string') {
          item.source = `${item.source}\n${footer}`;
        }
      }
    }
  };
}

const footerSetting = (fname)=>({
  js: `// ${camelCase(fname, true)}. ${getPrettyTime(1)} built@Loyuri`,
  css: `/* ${camelCase(fname, true)}. ${getPrettyTime(1)} built@Loyuri */`,
  dts: `// ${camelCase(fname, true)}. ${getPrettyTime(1)} built@Loyuri`,
});


function getFileName(pathName){
  const fullname = pathName.split(/[\\\/]/).at(-1);
  // remove postfix
  const dotPos = fullname.lastIndexOf('.');
  return dotPos>-1? fullname.slice(0, dotPos): fullname;
}

let filterList = null;
if(argvs["selecting"]){
  filterList = argvs["selecting"].split(',');
}

// 1) Generate a JS bundle config _for each_ entry
const jsConfigs = entryFiles.map(file => {
  const name = getFileName(file);
  if(filterList && !filterList.includes(name)) return;
  return {
    input: file,
    output: {
      file: `dist/${name}.min.js`,
      format: 'es',
      sourcemap: false,
    },
    treeshake: {
      moduleSideEffects: false // To remove dead code ultmately
    },
    plugins: [
      replace({// High priority
        preventAssignment: true,
        // Define constant replacement
        'DEBUG': 'false',
        'import.meta.env.DEV': 'false',
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        exclude: [
          "src/libs/**", // skip pure js files that no needs to do TS compilation
        ]
      }),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true
        },
        mangle: true
      }),
      rollupInlineTemplate({ isProduction: true }),
      footerPlugin(footerSetting(name))
    ],
    external: [// name of import module
      "minivue",
      "minivue-extra",
    ]  // ← add any externals here
  };
}).filter(Boolean);

// 2) generate the .d.ts bundles afterwards
const dtsConfigs = entryFiles.map(file => {
  const name = getFileName(file);
  if(filterList && !filterList.includes(name)) return;
  return {
    input: `dist-types/indexes/${name}.d.ts`,
    output: {
      file: `dist/${name}.d.ts`,
      format: 'es'
    },
    plugins: [
      dts({
        respectExternal: true,
        compilerOptions: {
          preserveSymlinks: false,
          sourceMap: false,
        }
      }),
      footerPlugin(footerSetting(name))
    ],
    external: [ // name of import module
      "minivue",
      "minivue-extra",
      
      // Resolve intersecting reference
      // ---
      "lyco-ctxmenu",
      "lyco-drag-exchange",
      "lyco-flip",
      "lyco-LRU",
      "lyco-playlist",
      "lyco-router",
      "lyco-shortcut",
      "lyco-i18n",
      "minipastel"
    ] // ← add any type externals here
  };
}).filter(Boolean);

export default [
  ...jsConfigs,
  ...dtsConfigs
];
