
stdlib: build/memory.wasm

build/%.wasm: stdlib/%.wat
	npx wat2wasm $< -o $@