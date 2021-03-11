class ComplexNumber:
    real: int = 0
    img: int = 0


    def new(self: ComplexNumber, real: int, img: int) -> ComplexNumber:
        self.real = real
        self.img = img
        
        return self

    # Returns the real part as an integer
    def getReal(self: ComplexNumber) -> int:
        return self.real

    # Returns the imaginary part as an integer
    def getImg(self: ComplexNumber) -> int:
        return self.img

    # Add the first argument to the second argument and return the result
    def add(self: ComplexNumber, other: ComplexNumber) -> ComplexNumber:
        newReal: int = self.getReal() + other.getReal()
        newImg: int = self.getImg() + other.getImg()
        
        return ComplexNumber().new(newReal, newImg)

    # Subtract second argument from the first and return the result
    def sub(self: ComplexNumber, other: ComplexNumber) -> ComplexNumber:
        newReal: int = self.getReal() - other.getReal()
        newImg: int = self.getImg() - other.getImg()
        
        return ComplexNumber().new(newReal, newImg)
    
    # Multiply two complex number and return the result
    def mult(self: ComplexNumber, other: ComplexNumber) -> ComplexNumber:
        newReal: int = self.getReal() * other.getReal() + self.getImg() * other.getImg()
        newImg: int = self.getReal() * other.getImg() + self.getImg() * other.getReal()
        
        return ComplexNumber().new(newReal, newImg)

    # Returns the magnitude of the complex number
    def magnitude(self: ComplexNumber) -> int:
        return self.isqrt(self.getReal()*self.getReal() + self.getImg()*self.getImg())

    # Square root using Newton's method
    def isqrt(self: ComplexNumber, n: int) -> int:
        x: int = n
        y: int = (x + 1) // 2
        
        while y < x:
            x = y
            y = (x + n // x) // 2
        
        return x

# Create 1 + 0i
unitReal: ComplexNumber = ComplexNumber().new(1, 0)

# Add 1 + i
dummy: ComplexNumber = ComplexNumber().new(1, 1)

# Add 2 + 3i
dummy = dummy.add(ComplexNumber().new(2, 3))

# Multiply with (1 + 0i)
dummy = dummy.mult(unitReal)

# Check if mag(dummy) == mag(3 + 4i)
print(dummy.magnitude() == 5)
