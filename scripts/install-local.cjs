const { copyFolder, fromWorkDir, clearDir } = require("./share.cjs");
const { LibPath } = require("./env-libs.cjs");

LibPath.forEach(async (group)=>{
  if(group.clear){
    await clearDir(group.from);
  }

  const filterFn = (fname, directory)=>{
    if(Array.isArray(group.confined)){
      if(!group.confined.some((supposedFName)=>fname===supposedFName)) return false;
    }else if(group.confined){
      const includeCfg = group.confined;
      // All prop value should be Array
      if(includeCfg.inDir){
        if(!includeCfg.inDir.some((supposedDir)=>directory.startsWith(supposedDir))) return false;
      }
      if(includeCfg.endsWith){
        if(!includeCfg.endsWith.some((supposedFName)=>fname.endsWith(supposedFName))) return false;
      }
      if(includeCfg.startsWith){
        if(!includeCfg.startsWith.some((supposedFName)=>fname.startsWith(supposedFName))) return false;
      }
      if(includeCfg.equalIn){
        if(!includeCfg.equalIn.some((supposedFName)=>fname===supposedFName)) return false;
      }
    }

    if(Array.isArray(group.ignoreList)){
      if(group.ignoreList.some((supposedFName)=>fname===supposedFName)) return false;
    }else if(group.ignoreList){
      const ignoredCfg = group.ignoreList;
      // All prop value should be Array
      if(ignoredCfg.inDir){
        if(ignoredCfg.inDir.some((supposedDir)=>directory.startsWith(supposedDir))) return false;
      }
      if(ignoredCfg.endsWith){
        if(ignoredCfg.endsWith.some((supposedFName)=>fname.endsWith(supposedFName))) return false;
      }
      if(ignoredCfg.startsWith){
        if(ignoredCfg.startsWith.some((supposedFName)=>fname.startsWith(supposedFName))) return false;
      }
      if(ignoredCfg.equalIn){
        if(ignoredCfg.equalIn.some((supposedFName)=>fname===supposedFName)) return false;
      }
    }

    if(Object.hasOwn(group,"sourcemap")){
      const isMapFile = fname.endsWith(".map");
      if(isMapFile)
        return !(isMapFile ^ group.sourcemap);
    }

    return true;
  };

  copyFolder(group.from, fromWorkDir(group.to), filterFn, true, (...p)=>console.log(...p)).then(()=>{
    if(group.postProcessor){
      group.postProcessor();
    }
  });
});


