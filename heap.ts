export type ProgramStore = {
  typeStore : GlobalTable,
  memStore: MemoryStore,
}

export type MemoryStore = {
  curFileVarIndex: number,

  fileVariables: Array<{varName: string, declrType: Type, val: Value}>
  fileVarIndex: Map<string, number>

  /*
   Maps function signatures (as string) to their assembly labels
   */
  fileFunctionLabels: Map<string, string>,

  /*
   Maps typecodes to their class names
   */
  fileTypes: Map<number, string>

  heap: Array<Instance>,
  heapIndex: number
}

/*
 Represents a runtime instance of a class
 */
export type Instance = {
  typeName: string,
  attributes: Array<Value>
}

function instanciate(typecode: number, store: ProgramStore) : number{
  const heapAddress = store.memStore.heapIndex;

  const className = store.memStore.fileTypes.get(typecode);
  const classDef = store.typeStore.classMap.get(className);

  console.log("-----------> instantiating!!! "+className);

  const attrs : Array<Value> = new Array(classDef.classVars.size);
  for(let {index, varDec} of Array.from(classDef.classVars.values())){
    if(varDec.value.tag === "value"){
      switch(varDec.value.value.tag){
        case "None" : {attrs[index] = {tag: "none"}; break;}
        case "Boolean" : {attrs[index] = {tag: "bool", value: varDec.value.value.value}; break;}
        case "Number" : {attrs[index] = {tag: "num", value: Number(varDec.value.value.value)}; break;}
      }
    }
  }

  store.memStore.heap.push({typeName: className, attributes: attrs});

  store.memStore.heapIndex++;
  return heapAddress;
}

function objRetr(address: number, attrIndex: number, store: ProgramStore) : number{  
  if(address === 0){
    throw new Error("Heap object at index "+address+" is None!");
  }

  const heapObject = store.memStore.heap[address];
  const attrValue = heapObject.attributes[attrIndex];
  switch(attrValue.tag){
    case "bool": {return attrValue.value ? 1 : 0}
    case "none": {return 0}
    case "num": {return attrValue.value}
    case "object": {return attrValue.address}
  }
}

function objMut(address: number, attrIndex: number, newValue: number, store: ProgramStore) {
  const attrValue = store.memStore.heap[address];

  //console.log("------ATTRIBUTE MUTATION!!! "+attrValue.typeName);
  
  if(attrValue.typeName === "none"){
    throw new Error("Heap object at index "+address+" is None!");
  }

  if(attrValue.attributes[attrIndex].tag === "num"){
    attrValue.attributes[attrIndex] = {tag: "num", value: newValue};
  }
  else if(attrValue.attributes[attrIndex].tag === "bool"){
    attrValue.attributes[attrIndex] = {tag: "bool", value: newValue === 0? false : true};
  }
  else{
    if(newValue === 0){
      attrValue.attributes[attrIndex] = {tag: "none"};
    }
    else{
      const heapObject = store.memStore.heap[newValue];
      attrValue.attributes[attrIndex] = {tag: "object", name: heapObject.typeName, address: newValue};
    }
  }
}

function globalStore(varIndex: number, newValue: number, store: ProgramStore) {
  const varInfo = store.memStore.fileVariables[varIndex];

  //console.log("------GLOBAL VAR MUTATION!!! "+varIndex+" | "+varInfo.varName);

  /*
  if(varInfo === undefined){
    throw new Error(`unknown global STORE? caller: ${varIndex} | ${store.memStore.fileVariables.length} | ${store.memStore.curFileVarIndex} PROGS: 
       ${curSource.join("\n")}
        INSTRS: 
        ${curInstr.join("\n")}`);
  }
  */

  if(varInfo.declrType.tag === "number"){
    store.memStore.fileVariables[varIndex].val =  {tag: "num", value: newValue};
  }
  else if(varInfo.declrType.tag === "bool"){
    store.memStore.fileVariables[varIndex].val = {tag: "bool", value: newValue === 0? false : true};
  }
  else{
    if(newValue === 0){
      console.log("------- gvar is nulled!");
      store.memStore.fileVariables[varIndex].val = {tag: "none"};
    }
    else{
      const heapObject = store.memStore.heap[newValue];
      console.log("------- still gvar mut "+(heapObject === undefined)+" | "+newValue)
      store.memStore.fileVariables[varIndex].val = {tag: "object", name: heapObject.typeName, address: newValue};
    }
  }
}

function globalRetr(varIndex: number, store: ProgramStore) : number {
  const varInfo = store.memStore.fileVariables[varIndex];

  /*
  if(varInfo === undefined){
    throw new Error(`unknown global? caller: ${varIndex} | ${store.memStore.fileVariables.length} | ${store.memStore.curFileVarIndex} PROGS: 
       ${curSource.join("\n")}
        INSTRS: 
        ${curInstr.join("\n")}`);
  }
  */

  switch(varInfo.val.tag){
    case "bool": {return varInfo.val.value ? 1 : 0}
    case "none": {return 0}
    case "num": {return varInfo.val.value}
    case "object": {return varInfo.val.address}
  }
}