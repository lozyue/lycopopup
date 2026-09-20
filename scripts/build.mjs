import { rollup } from 'rollup'
import configs from './rollup.config.js'
import { postProcessRollupOutputs } from "./wrap-type-as-module.mjs"
import { getFileNameFromPath } from './sharer-es.js';

//---
// key: filename, value: declare module name
//---
const FixTypeModuleList = { 
  "lyco-playlist.d.ts": "playlist",
};

async function build() {
  if(configs.length<=0){
    console.warn("Not available task.");
    return 0;
  }

  for (const config of configs) {
    const bundle = await rollup(config);

    const outputs = Array.isArray(config.output)
      ? config.output
      : [config.output];
    for(const output of outputs){
      await bundle.write(output);
    }

    await bundle.close();

    await postProcessRollupOutputs(outputs, {
      indent: "    ",
      moduleNameFilter: (filePath)=>{
        const fname = getFileNameFromPath(filePath);
        return Object.hasOwn(FixTypeModuleList,fname);
      },
      moduleNameFromOutput: (output, filename)=>{
        // Example: use basename of d.ts (without ext) as module name,
        // or return a fixed alias like 'playlist' if you want TS imports to resolve to that name.
        const fname = getFileNameFromPath(filename? filename: output.file);
        if(Object.hasOwn(FixTypeModuleList,fname)) return FixTypeModuleList[fname];
        if(filename) return path.basename(filename, '.d.ts');
        if(output.file) return path.basename(output.file, '.d.ts');
        return undefined;
      }
    });
  }
}

build();