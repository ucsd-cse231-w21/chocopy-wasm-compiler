def print_pattern(lines: int):
    result: str = ""
    count: int = 1

    if (lines < 1):
        print("Error: Number of lines should be a positive integer")

    while (count < lines):
        result = result + "1"*count + "\n"

        count = count + 1

    print(result)

print_pattern(30)
