
export function getFileNameFromPath(filePath) {
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



export function getPrettyTime(type = 0, dateTime = new Date()) {
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


/**
 * camelCase("foo-bar_baz")           // "fooBar_baz"
 * camelCase("foo-bar_baz", true)     // "FooBar_baz"
 * camelCase("some-value_42", true)   // "SomeValue_42"
 * camelCase("some-value_42", false)  // "someValue_42"
 */
export function camelCase(input, upperHead = false){
  return input
    .split('-') // 仅以 "-" 分割，保留 "_" 原样
    .map((part, index) => {
      if (index === 0 && !upperHead) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}


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
export function getCommandArguments(){
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