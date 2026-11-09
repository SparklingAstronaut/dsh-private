export function privateImageExtension(header){
  if(header.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return 'png';
  if(header.subarray(0,3).toString('hex')==='ffd8ff')return 'jpg';
  if(header.subarray(0,4).toString()==='RIFF'&&header.subarray(8,12).toString()==='WEBP')return 'webp';
  throw Error('Unsupported private input image');
}
