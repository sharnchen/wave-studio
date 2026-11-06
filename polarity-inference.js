// Average f(x) and -f(-x) to suppress polarity-asymmetric prediction artifacts.
export async function predictSpectrum(input,infer,dualPass=false){
 const positive=Float32Array.from(await infer(input));
 if(!dualPass)return positive;
 const negativeInput=Float32Array.from(input,x=>-x);
 const negative=await infer(negativeInput);
 if(negative.length!==positive.length)throw Error('模型兩次輸出的長度不一致');
 for(let i=0;i<positive.length;i++)positive[i]=(positive[i]-negative[i])*.5;
 return positive;
}
