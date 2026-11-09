// Preserve edits made by another tool while a program was running.
export function mergeExecutionFiles(current,baseline,output){
 const conflicts=[];current.files??={};
 for(const [key,file] of Object.entries(output??{})){
  if(JSON.stringify(current.files[key])!==JSON.stringify(baseline?.[key])){
   if(JSON.stringify(current.files[key])!==JSON.stringify(file))conflicts.push(file.path);
   continue;
  }
  current.files[key]=file;
 }
 return conflicts;
}
