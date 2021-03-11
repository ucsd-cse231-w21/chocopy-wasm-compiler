class Vector:
    head: Vector = None
    tail: Vector = None
    val: int = 0

    def create(self: Vector, val: int) -> Vector:
        self.val = val
        return self

    def append(self: Vector, val: int) -> Vector:
        newObj: Vector = Vector()
        newObj.val = val
        
        if (self.head is None):    
            self.head = newObj

        if (self.tail is None):
            self.tail = newObj
        else:
            self.tail.head = newObj
            self.tail = newObj
        
        return self

    def print(self: Vector):
        print(self.val)

        if (not self.head is None):
            self.head.print()

head: Vector = Vector().create(1)
head.append(2).append(3).append(4)
head.append(5)

head.print()
