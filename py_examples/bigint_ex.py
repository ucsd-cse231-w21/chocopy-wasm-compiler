class BigInt:
    val: str = ""
    
    def new(init: int) -> BigInt:
        if (init < 0):
            print("Caution: negative numbers are currently not implemented")
        val = init
