const { sep, resolve:pathResolve,relative:pathRelative } = require("node:path");
const { readdir,mkdir,copyFile,stat,rm,unlink  } = require("node:fs/promises");

const WorkDirectory = process.cwd();
// Return the absolute path from the work directory.
function fromWorkDir(relativePath){
  return pathResolve(WorkDirectory, relativePath);
}
exports.fromWorkDir = fromWorkDir;


function getFileNameFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  
  const separators = ['\\', '/'];
  let lastSeparatorIndex = -1;
  
  // Find the last path separator by checking from the end
  for (let i = filePath.length - 1; i >= 0; i--) {
    if (separators.includes(filePath[i])) {
      lastSeparatorIndex = i;
      break;
    }
  }
  
  // If no separator found, return the entire string
  // Otherwise, return substring after the last separator
  return lastSeparatorIndex === -1 
    ? filePath 
    : filePath.substring(lastSeparatorIndex + 1);
}
module.exports = getFileNameFromPath;

async function waitUntilQueueIdle(queue) {
  for (let i = 0; i < queue.length; i++) {
    await queue[i];
  }
}
/**
 * Fast copy directory function. (Absolute path)
 * The error case waits for further process.
 * Async function.
 * @param {*} source 
 * @param {*} dest 
 */
function copyFolder(source, dest, filter=(fname,dir)=>true, patchMode=true, logout=NoopFunction){
  const waitAllQueue = [];

  const CopyDirentList = async (taskStack, rDirectory)=>{
    while(taskStack.length){
      let direntObj = taskStack.shift();
      if(rDirectory!=='.' // Skip entry dir
        && !filter(direntObj.name, rDirectory)
      ) continue;

      const place = rDirectory+'/'+direntObj.name;
      const absSource = pathResolve(source, place);
      const absDest = pathResolve(dest, place);
      if(direntObj.isDirectory() ){
        const readPromise = readdir(absSource, { withFileTypes:true }).then((files)=>{
          const mdPromise = new Promise(resolve=>{
            mkdir(absDest).then(()=>{
              logout(`Created Folder Successfully: ${place} on ${dest}`);
              // Recurse async
              CopyDirentList(files, place).then(resolve);
            }).catch(err=>{
              if(err.code==="EEXIST"){
                // console.log("Already existed directory!", err.message);
                CopyDirentList(files, place).then(resolve);
              }else{
                resolve();
              }
            });
          });
          waitAllQueue.push(mdPromise);
        });
        waitAllQueue.push(readPromise);
      }else{
        if(patchMode){
          const waitSrc = stat(absSource);
          const waitDest = stat(absDest).catch(err=>{
            if(err.code==="ENOENT"){
              return null;
            }
            throw err;
          });
          waitAllQueue.push(waitSrc, waitDest);

          const srcStat = await waitSrc;
          const destStat = await waitDest;
          if(!destStat|| srcStat.mtimeMs>destStat.mtimeMs|| (srcStat.mtimeMs===destStat.mtimeMs && srcStat.size!==destStat.size)){
            const mdPromise = copyFile(absSource, absDest);
            mdPromise.then(()=>{
              logout(`Copy file Successfully: ${place} on ${dest}`);
            });
            waitAllQueue.push(mdPromise); // Still the built-in promise can not sovle this async waitAll!
          }
          else{
            // Skip file
          }
        }
      }
    }
  };

  const start = stat(source).then((info)=>{
    const stack = []; // Dirent Object list.
    // const filename = source.slice( source.lastIndexOf('/')+1 );
    if(info.isDirectory() ){
      stack.push({
        name: "",
        isDirectory: ()=>true,
      });
    }else {
      stack.push({
        name: "",
        isDirectory: ()=>false,
      });
    }
    CopyDirentList(stack, '.');
  });
  waitAllQueue.push(start);
  return waitUntilQueueIdle(waitAllQueue);
}
exports.copyFolder = copyFolder;

/**
 * 
 * @param {{in:string,out:string}} indicator 
 * @param {boolean} patch update only when modified.
 * @param {string} baseAbs Absolute base dir for relative indicator. 
 */
async function copyFileP2P(indicator, patch=true, baseAbs=''){
  const waitAllQueue = [];
  for(let one of indicator){
    const absIn = baseAbs? pathResolve(baseAbs,one.in): fromWorkDir(one.in);
    const absOut = baseAbs? pathResolve(baseAbs,one.out): fromWorkDir(one.out);
    const srcStat = await stat(absIn);
    const destStat = await stat(absOut).catch(err=>{
      if(err.code==="ENOENT"){
        return null;
      }
      throw err;
    });
    if(!destStat|| srcStat.mtimeMs>destStat.mtimeMs|| (srcStat.mtimeMs===destStat.mtimeMs && srcStat.size!==destStat.size)){
      const mdPromise = copyFile(absIn, absOut);
      waitAllQueue.push(mdPromise); // Still the built-in promise can not sovle this async waitAll!
    }
    else{
      // Skip file
    }
  }
  await Promise.allSettled(waitAllQueue);
}
exports.copyFileP2P = copyFileP2P;


function clearDir(dirPath){
  const promiseQueue = [];
  const waitStart = readdir(dirPath, {withFileTypes:true}).then((files)=>{
    (files).forEach((direntObj)=>{
      const filePath = pathResolve(dirPath, direntObj.name); 
      if(direntObj.isDirectory()){
        const waitRemove = rm( filePath, {
          recursive: true, force: true,
        });
        promiseQueue.push(waitRemove);
      }else if(direntObj.isFile()|| direntObj.isSymbolicLink() ){
        const waitUnlink = unlink(filePath);
        promiseQueue.push(waitUnlink);
      }
    });
  })
  .catch(err=>{
    if(err.code!=="EEXIST"){
      console.warn("The target folder is not existed!");
    }else
      throw err;
  });

  return waitStart.then(()=>{
    return Promise.all(promiseQueue)
  });
}
exports.clearDir = clearDir;

function setupProcessEnv(){
  const cArgs = getCommandArguments();
  Object.keys(cArgs).forEach(argName=>{
    if(!argName.startsWith("--") && cArgs[argName]!==undefined){
      process.env[argName] = cArgs[argName];
    }
  });

  // Start the app.
  const lastNumberArg = process.argv.length-2-1;
  const mainJS = cArgs[lastNumberArg];
  if(mainJS && mainJS.endsWith(".js")){
    require( pathRelative(relativeFrom(), mainJS) );
  }
}
exports.setupProcessEnv = setupProcessEnv;


// -----

const WorkingDirectory = process.cwd(); // Immutable.
const relativeFrom = (calleeDirname=__dirname)=>{
  return pathRelative(WorkingDirectory, calleeDirname).replaceAll('\\', '/');
};

function getTypedString(value, options={}){
  if(options.Boolean)
    value = value==='true'||(value==='false'?false:value)
  if((typeof value==='string') && options.Number){
    var parsed = parseFloat(value);
    if(!isNaN(parsed) ){
      value = parsed;
    }
  }
  // As string!
  return value+'';
}
function getCommandArguments(){
  const consequence = {};
  process.argv.slice(2).forEach((item, index) => {
    var value;
    var howManySeparate =0 ;
    while(item.length && item[0]==='-'){
      item = item.slice(1);
      howManySeparate++;
    }
    if(!item.length) return;

    var splitor = item.indexOf("=");
    if(splitor>-1 && splitor<item.length){
      var value = item.slice(splitor+1);
      consequence[item.slice(0,splitor)] = getTypedString(value);
    }else if(howManySeparate==2){
      consequence[item] = true;
    }else{
      consequence[index] = item;
    }
  });
  consequence['--executor'] = process.argv[0];
  consequence['--filePath'] = process.argv[1];
  return consequence;
}

function getPrettyTime(type = 0, dateTime = new Date()) {
  const timeInDay = `${('0' + dateTime.getHours()).slice(-2)}:${('0' + dateTime.getMinutes()).slice(-2)}:${('0' + dateTime.getSeconds()).slice(-2)}`;
  if (type <= 0)
      return timeInDay;
  const timeInMonth = `${dateTime.getFullYear()}/${('0' + (dateTime.getMonth() + 1)).slice(-2)}/${('0' + dateTime.getDate()).slice(-2)}`;
  if (type <= 1)
      return timeInMonth;
  else if (type <= 2)
      return timeInMonth + ' ' + timeInDay;
  else if (type <= 3)
      return timeInMonth + ' ' + timeInDay.slice(0, 5);
  else {
      throw new Error("Type should selected from 0,1,2,3");
  }
}
exports.getPrettyTime = getPrettyTime;


module.exports = exports;
