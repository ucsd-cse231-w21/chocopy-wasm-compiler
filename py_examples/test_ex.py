a: int = 128
b: int = 12

temp1: bool = False
temp2: bool = not temp1


def done(msg: str):
    decoratedMsg: str = "Done: " + msg
    print(decoratedMsg)


def assert_(cond:bool):
    temp:int = 0
    if not cond:
        temp = 1 // 0


# Function to swap global variables
def swap():
     temp: int = a

     a = b
     b = temp


def check_swap():
    a = 100
    b = 200

    assert_(a == 100)
    assert_(b == 200)

    swap()

    assert_(a == 200)
    assert_(b == 100)
    done("swap")


def check_bools():
    assert_(True)
    assert_(not False)
    done("bools")


def check_operators():
    assert_(1+1 == 2)
    assert_(1-1 == 0)
    assert_(0-1 == -1)
    assert_(1*0 == 0)
    assert_(2//2 == 1)
    assert_(5 % 3 == 2)
    assert_(5 > 0)
    assert_(5 > -5)
    assert_(10 < 100)
    assert_(10 != 1000)
    done("operators")


def check_init():
    assert_(a == 128)
    assert_(b == 12)
    done("init")


def check_if():
    if temp1:
        assert_(False)
    elif not temp2:
        assert_(False)
    elif not temp2:
        assert_(False)
    elif not temp2:
        assert_(False)
    elif not temp2:
        assert_(False)
    else:
        if not True:
            assert_(False)
        else:
            assert_(True)
    done("If statement")


def run_checks():
    check_init()
    check_swap()
    check_bools()
    check_operators()
    check_if()


run_checks()
