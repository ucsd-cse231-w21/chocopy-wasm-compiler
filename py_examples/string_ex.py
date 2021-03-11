# Function to add border to a string and
# print it
def print_pattern(a: str):
    print("-"*8)
    print(a)
    print("-"*8)


# Declare a new string
hello_world: str = "Hello! World"
print_pattern(hello_world)


# Get the length of the string
print(" ")
str_len: int = len(hello_world)
print("Length: len(hello_world)")
print(str_len)


##############################
# Slicing strings
print(" ")
print("Slicing strings:")

numbers: str = "1 2 3 4 5 6 7 8"
print(numbers[0:len(numbers):2])

# Advanced slicing
print(numbers[::2])
##############################

##############################
# Iterators
##############################
print(" ")
print("Iterators:")

num: str = None

for num in numbers:
    if num != " ":
        print(num)
