---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
keywords: [class, inheritance, polymorphism, encapsulation, property, dunder, dataclass, ABC, abstractmethod, super]
description: "Python OOP reference with executable examples and cell outputs — covers classes, inheritance, polymorphism, encapsulation, properties, dataclasses, and abstract base classes. See [06_cs_oop](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/06_cs_oop) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - Python

> [!quote]
> "I made up the term 'object-oriented', and I can tell you I did not have C++ in mind."
>
> — **Alan Kay**, email to Stefan Ram (2003)
>
> "You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."
>
> — **Joe Armstrong**, *Coders at Work* interview (2009)

```python
import math
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable, Optional
from dataclasses import dataclass, field
```

## Classes & Objects

#### Class definition — __init__, attributes, __str__

> [!info] Class basics
>
> - `class Dog:` — defines a type
> - `__init__` — initializes instance attributes (`self.name`)
> - Class attributes (`species`) — shared by all instances
> - `__str__` — human-readable output for `print()` and f-strings
> - For simple data containers without behavior, prefer `dataclass` or `namedtuple`

> [!warning] Anti-patterns
>
> - **Mutable class attributes** (lists/dicts) — shared and mutated by all instances
> - **Not defining `__repr__`** — defaults to unhelpful `<Dog at 0x...>`
> - **`__init__` doing heavy work** — use factory methods for complex setup

```python
# Classes and objects — class is the blueprint; instances are created with ClassName()

# Dog — class attribute shared by all, instance attributes unique to each, methods operate on self
class Dog:
    species = "Canis familiaris"       # class attribute — shared by ALL instances

    def __init__(self, name, age):
        self.name = name               # instance attribute — unique to each object
        self.age = age
        self.color: str | None = None  # declared here to satisfy type checkers

    def bark(self):
        return f"{self.name} says Woof!"

    def is_older_than(self, other):
        return self.age > other.age

    def __str__(self):
        return f"Dog({self.name}, age={self.age})"

    def __repr__(self):
        return f"Dog(name='{self.name}', age={self.age})"
```

#### Instance vs class attributes — instantiation and attribute access

```python
# Using classes — instantiation, attribute access, method calls

dog1 = Dog("Rex", 5)
dog2 = Dog("Buddy", 3)

dog1  # calls __str__
dog1.name  # access attribute
dog1.bark()  # call method
dog1.species  # class attribute (shared)
dog1.is_older_than(dog2)   # older?

dog1.color = "brown"                              # works because we declared it in __init__
dog1.color   # dog1.color
dog2.color  # None — default from __init__
```

    Dog(Rex, age=5)
    Rex
    Rex says Woof!
    Canis familiaris
    True
    brown
    None

#### Class vs instance attribute shadowing

```python
# Class vs instance attribute shadowing — shared vs per-instance state

Dog.species  # access on class
dog1.species  # access on instance (falls back to class)

dog1.species = "Modified"                         # creates INSTANCE attribute, doesn't change class
dog1.species  # "Modified" (instance)
dog2.species  # still "Canis familiaris" (class)
Dog.species  # still "Canis familiaris" (class)
```

    Canis familiaris
    Canis familiaris
    Modified
    Canis familiaris
    Canis familiaris

#### @property — controlled access with validation

The `@property` decorator turns a method into an attribute-style accessor with optional validation. The getter looks like `obj.radius` (no parentheses), but runs validation code behind the scenes. Pair with `@name.setter` for write access.

```python
# @property — controlled access with validation and computed attributes

class Circle:
    def __init__(self, radius):
        self._radius = radius                     # convention: _ prefix = "private"

    @property                                     # getter — access like attribute, not method
    def radius(self):
        return self._radius

    @radius.setter                                # setter — validate on assignment
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius can't be negative")
        self._radius = value

    @property                                     # computed property (read-only)
    def area(self):
        return math.pi * self._radius ** 2

c = Circle(5)
c.radius  # calls getter (no parentheses!)
f"{c.area:.2f}"  # computed, read-only
c.radius = 10                                     # calls setter (validates)
c.radius   # new radius
```

> [!info] Property Validation
>
> Setters with validation raise exceptions for invalid values. Read-only properties (no setter) raise `AttributeError` on assignment.

    radius: 5
    area:   78.54
    new radius: 10

## Inheritance & Polymorphism

#### Inheritance — base class, super().__init__, method override

A child class acquires all attributes and methods of a parent class and can extend or override them. Python supports multiple inheritance (a class can have multiple parents), resolved via the Method Resolution Order (MRO).

> [!warning] Diamond inheritance — multiple parents sharing a grandparent
>
> With multiple inheritance, if two parents share a grandparent, methods could be called twice. Python's MRO (C3 linearization) prevents this, but the order may surprise you. Check with `ClassName.__mro__`.

`class Dog(Animal)` inherits from `Animal`. Override methods by redefining them; `super().__init__()` calls the parent constructor. Python supports multiple inheritance via MRO (C3 linearization). Use inheritance for IS-A relationships; prefer composition (attributes) for HAS-A.

> [!warning] Anti-patterns
>
> - **Deep hierarchies** (>3 levels) — prefer composition
> - **Forgetting `super().__init__()`** — parent state not initialized
> - **Diamond inheritance** without understanding MRO — confusing dispatch

```python
# Inheritance and polymorphism — child classes extend a parent; method overriding enables runtime dispatch

# Animal — base class with speak that subclasses can override
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound

    def speak(self):
        return f"{self.name} says {self.sound}!"

    def __str__(self):
        return f"{type(self).__name__}({self.name})"

# Dog — inherits from Animal; adds breed and a Dog-specific method
class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Woof")     # call parent's __init__
        self.breed = breed

    def fetch(self):
        return f"{self.name} fetches the ball!"

# Cat — overrides speak with its own behavior
class Cat(Animal):
    def __init__(self, name):
        super().__init__(name, "Meow")

    def speak(self):
        return f"{self.name} says {self.sound}... when it feels like it."
```

#### Using inheritance — subclass instantiation and polymorphic calls

```python
# Using inheritance — instantiate subclasses, call overridden methods

dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

dog.speak()  # inherited from Animal
dog.fetch()  # Dog-specific
cat.speak()  # overridden version
dog.breed   # dog.breed
```

    Rex says Woof!
    Rex fetches the ball!
    Whiskers says Meow... when it feels like it.
    German Shepherd

#### Polymorphism and type checking

A variable can hold objects of different types and calling the same method executes the correct version for each type at runtime. In Python, this works via duck typing — no base class or interface required. If it has a `.speak()` method, it's valid.

```python
# Polymorphism and type checking — duck typing and isinstance

def animal_roll_call(animals):
    """Works with ANY Animal — doesn't care which specific type."""
    for animal in animals:
        print(f"  {animal}: {animal.speak()}")

animals = [Dog("Rex", "Shepherd"), Cat("Whiskers"), Dog("Buddy", "Lab")]
animal_roll_call(animals)                  # each calls its own speak()

isinstance(dog, Dog)  # True
isinstance(dog, Animal)  # True (Dog IS an Animal)
isinstance(cat, Dog)  # False
issubclass(Dog, Animal)  # True
```

       Rex says Woof!
       Whiskers says Meow... when it feels like it.
       Buddy says Woof!
    True
    True
    False
    True

#### Mixin classes — add capabilities via multiple inheritance

A mixin is a class designed to be combined with other classes via multiple inheritance, adding a specific capability (logging, serialization, comparison) without being a standalone base class. Mixins have no `__init__` of their own and assume the host class provides certain attributes.

```python
# Mixin — add capabilities via multiple inheritance

class Flyable:
    name: str                          # declare so type checkers know about it
    def fly(self):
        return f"{self.name} is flying!"

class Swimmable:
    name: str                          # declare so type checkers know about it
    def swim(self):
        return f"{self.name} is swimming!"

# Mixins combined with a "real" class that has __init__:
class Duck(Animal, Flyable, Swimmable):    # inherits from 3 classes!
    def __init__(self, name):
        super().__init__(name, "Quack")

duck = Duck("Donald")
duck.speak()   # speak
duck.fly()   # fly
duck.swim()   # swim
[c.__name__ for c in Duck.__mro__]  # Method Resolution Order (from left to right)
```

    speak: Donald says Quack!
    Donald is flying!
    Donald is swimming!
    ['Duck', 'Animal', 'Flyable', 'Swimmable', 'object']

## Abstract Classes & Interfaces

#### Abstract class

> [!info] Abstract base class
>
> - `class Shape(ABC)` with `@abstractmethod` — defines methods subclasses must implement
> - Concrete methods provide shared logic
> - Instantiating an abstract class raises `TypeError`
> - For pure contracts without shared code, use `Protocol` instead

> [!warning] Anti-patterns
>
> - **ABC with no shared code** — use `Protocol` for structural typing
> - **Forgetting `@abstractmethod`** — method becomes optional, not enforced
> - **Too many abstract methods** — split into smaller ABCs

```python
# Abstract class — Shape defines the contract; subclasses must implement area/perimeter

# Shape — abstract base; area and perimeter are abstract, describe is concrete
class Shape(ABC):
    """Can't instantiate Shape directly — must subclass."""

    def __init__(self, color="black"):
        self.color = color

    @abstractmethod
    def area(self) -> float:
        pass

    @abstractmethod
    def perimeter(self) -> float:
        pass

    def describe(self):
        return f"{self.color} {type(self).__name__}: area={self.area():.2f}"

# Rectangle — implements area and perimeter for width × height
class Rectangle(Shape):
    def __init__(self, width, height, color="black"):
        super().__init__(color)
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

# Circle — implements area and perimeter for a radius
class Circle(Shape):
    def __init__(self, radius, color="black"):
        super().__init__(color)
        self.radius = radius

    def area(self) -> float:
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        return 2 * math.pi * self.radius
```

#### Using ABC — instantiate subclasses, enforce abstract methods

```python
# Using abstract classes — instantiate subclasses, call abstract methods

rect = Rectangle(5, 3, "red")
circ = Circle(4, "blue")

rect.describe()   # rect
circ.describe()   # circ

# Polymorphism with abstract class
shapes: list[Shape] = [rect, circ]
total_area = sum(s.area() for s in shapes)
f"{total_area:.2f}"   # Total area
```

    rect: red Rectangle: area=15.00
    circ: blue Circle: area=50.27
    65.27

#### Protocol — structural typing without explicit inheritance

A Protocol defines a set of methods that a class must have, checked by type checkers (mypy) without requiring explicit inheritance. It is Python's answer to Go interfaces — "if it quacks like a duck." Classes satisfy a Protocol simply by having the right methods with the right signatures.

```python
# Protocol — structural typing without inheritance (duck typing formalized)

// When to use:
#   - Third-party classes that can't inherit your ABC
#   - Duck typing with type checker support
#
# When NOT to use:
#   - When shared implementation is needed — use ABC instead

# Protocol — structural typing; any class with the right methods matches, no inheritance needed

# Drawable — any class with a draw() method qualifies
@runtime_checkable
class Drawable(Protocol):
    """Any class with a draw() method qualifies — no inheritance needed."""
    def draw(self) -> str: ...

# Button and TextBox — do NOT inherit from Drawable, but satisfy the protocol
class Button:
    def draw(self) -> str:
        return "Drawing button"

class TextBox:
    def draw(self) -> str:
        return "Drawing textbox"

# render accepts anything with draw()
def render(widget: Drawable):
    print(f"  {widget.draw()}")

render(Button())
render(TextBox())
isinstance(Button(), Drawable)  # True!
```

      Drawing button
      Drawing textbox
    Button is Drawable? True

| Feature | ABC | Protocol |
|---|---|---|
| Inheritance | Explicit: `class Rect(Shape)` | None needed — just have the right methods |
| Methods | Concrete + abstract (partial implementation) | Pure contract (just signatures) |

## Encapsulation & Access Control

#### Encapsulation — public, _protected, __private name mangling

Python uses conventions, not enforcement: `name` is public, `_name` is protected (convention), and `__name` triggers name mangling (`_ClassName__name`) to prevent accidental override in subclasses. `@property` provides validated access to private backing fields. Use `_` for internal implementation details and `__` only for name-collision prevention — `__` for privacy alone is overkill.

> [!warning] Anti-patterns
>
> - **Accessing `_private` attrs from outside** — violates the convention
> - **Overusing `__mangling`** — makes testing and inheritance harder
> - **No access control at all** — public everything loses encapsulation

```python
# Encapsulation — Python uses naming conventions instead of enforced access modifiers

# BankAccount — public (name), protected (_balance), private (__pin via name mangling)
class BankAccount:
    def __init__(self, owner, balance):
        self.owner = owner           # public (no prefix)
        self._balance = balance      # "protected" (convention: don't touch)
        self.__pin = 1234            # "private" (name mangling)

    def deposit(self, amount):
        if amount > 0:
            self._balance += amount

    def get_balance(self):           # controlled access
        return self._balance

    def __validate_pin(self, pin):   # "private" method
        return pin == self.__pin

acc = BankAccount("Alice", 1000)
acc.owner  # public — OK
acc._balance  # "protected" — works but shouldn't
# print(acc.__pin)                        # AttributeError! Name mangled
acc._BankAccount__pin  # name mangling — still accessible!  # type: ignore
[a for a in dir(acc) if 'pin' in a.lower()]   # dir(acc) with __
# Shows _BankAccount__pin — Python renamed it
```

    Alice
    _balance: 1000
    1234
    dir(acc) with __: ['_BankAccount__pin', '_BankAccount__validate_pin']

#### Access comparison

```python
# Access convention comparison — Python naming vs C# access modifiers

comparison = """
name                public              accessible everywhere
_name               protected           accessible in class + subclasses (convention in Python)
(no equivalent)     internal            accessible within same assembly/project
(no equivalent)     protected internal  protected OR internal
(no equivalent)     private protected   protected AND internal
"""
comparison
# Python: conventions only — nothing is truly private
```

    
    name                public              accessible everywhere
    _name               protected           accessible in class + subclasses (convention in Python)
    (no equivalent)     internal            accessible within same assembly/project
    (no equivalent)     protected internal  protected OR internal
    (no equivalent)     private protected   protected AND internal
    
    Python: conventions only — nothing is truly private

#### __slots__ — restrict attributes and reduce memory usage

`__slots__` restricts a class to a fixed set of attributes, preventing dynamic attribute creation via `__dict__`. This reduces memory usage by ~40% for classes with many instances (e.g., millions of price records). Any attempt to set an attribute not listed in `__slots__` raises `AttributeError`.

> [!warning] __slots__ disables dynamic attributes
>
> With `__slots__`, you cannot add arbitrary attributes at runtime (`obj.new_attr = 1` raises `AttributeError`). Subclasses without their own `__slots__` reintroduce `__dict__`, negating the memory savings. If you need both slots and dataclass, use `@dataclass(slots=True)` (Python 3.10+).

## Static & Class Methods

#### @staticmethod and @classmethod — definition and factory methods

> [!info] Class methods vs static methods
>
> - `@classmethod` — receives `cls` as first argument; enables factory methods and inheritance-aware construction
> - `@staticmethod` — gets no implicit argument; just a function namespaced to the class
> - Use `@classmethod` for factories; `@staticmethod` for class-namespaced utilities

> [!warning] Anti-patterns
>
> - **`@staticmethod` when a module-level function is clearer** — unnecessary nesting
> - **Instance method when `self` is never used** — make it `@staticmethod`
> - **Not using `cls` in `@classmethod`** — should be `@staticmethod` instead

```python
# Static and class methods — @classmethod receives cls for factories; @staticmethod has no self/cls

# Employee — instance method (self), @classmethod (cls), @staticmethod (no self/cls)
class Employee:
    company = "Acme Corp"              # class attribute — shared by all instances
    _employee_count = 0

    def __init__(self, name, salary):
        self.name = name
        self.salary = salary
        Employee._employee_count += 1

    # Instance method — operates on self (the specific employee)
    def give_raise(self, percent):
        self.salary *= (1 + percent / 100)
        return self.salary

    # @classmethod — receives the CLASS, not an instance; used as factory
    @classmethod
    def from_string(cls, data_string):
        """Create Employee from 'name,salary' string."""
        name, salary = data_string.split(",")
        return cls(name, float(salary))    # cls() works with subclasses too

    @classmethod
    def get_count(cls):
        return cls._employee_count

    # @staticmethod — no self, no cls; utility function in the class namespace
    @staticmethod
    def is_valid_salary(salary):
        """Validate salary without needing an instance."""
        return salary > 0

    def __str__(self):
        return f"{self.name} @ {self.company}: ${self.salary:,.0f}"
```

#### Using @staticmethod and @classmethod — calls and inheritance

```python
# Using static and class methods — factories and aggregate operations

emp1 = Employee("Alice", 95000)
emp1.give_raise(10)
emp1   # Instance

# Class method — called on the class, creates an object
emp2 = Employee.from_string("Bob,85000")
emp2   # Factory

# Static method — no instance needed
Employee.is_valid_salary(50000)   # Static:   valid salary?
Employee.is_valid_salary(-100)   # Static:   valid salary?

# Class attribute
f"Count:    {Employee.get_count()} employees"
Employee.company   # Company
```

    Alice @ Acme Corp: $104,500
    Bob @ Acme Corp: $85,000
    valid salary? True
    valid salary? False
    2 employees
    Acme Corp

#### @classmethod inheritance — cls is the subclass

```python
# @classmethod inheritance — cls is the subclass, enabling polymorphic factories

class Manager(Employee):
    pass

# cls is Manager, not Employee — creates a Manager object!
mgr = Manager.from_string("Charlie,120000")
type(mgr).__name__  # Manager, not Employee
# If from_string used @staticmethod with Employee(), it would always create Employee
```

    Manager

## Dataclasses & Records

#### Why dataclasses instead of dicts

Dicts accept any key (including typos) and any value type — errors only appear at runtime. Dataclasses enforce field names and types at definition, with IDE autocomplete and type-checker support. Typos are caught before the code runs, and refactoring tools rename fields across the codebase.

In data pipelines, all data ends up serialized (JSON, Parquet, CSV) and stored in databases. So why bother with classes? Dataclasses aren't for the data itself (that flows through pandas/Spark/SQL) — they're for everything *around* the data: configs, metadata, API responses, pipeline state, error reports, task definitions.

| When dicts win | When dataclasses win |
|---|---|
| Exploratory/ad-hoc work, notebooks | Production pipelines that run unattended (typos = 3am failures) |
| Unknown/dynamic schemas (arbitrary JSON from external API) | Shared code between team members (self-documenting) |
| Pandas DataFrames (already structured) | Anything that gets deployed and must not fail silently |
| Quick scripts you'll run once | APIs (input/output contracts), configs, orchestration state |

#### Dict vs @dataclass — silent typos and missing validation

```python
# Dict vs dataclass — typos pass silently with dicts

record = {"customer_id": 123, "amout": 99.99}     # typo: "amout" not "amount"
# total = record["amount"]                          # KeyError in production!

# Dataclass: typo is caught immediately at creation time
@dataclass
class Order:
    customer_id: int
    amount: float
# order = Order(customer_id=123, amout=99.99)      # TypeError IMMEDIATELY
order = Order(customer_id=123, amount=99.99)

```

    silent bug (amout instead of amount)
    TypeError at creation time

#### Autocomplete, refactoring, and type safety

> [!tip] Dataclass IDE Advantages Over Dict
>
> - **Autocomplete:** Dict keys must be memorized. Dataclass fields show on `.` in the IDE.
> - **Refactoring:** Renaming a dict key requires search-and-replace across all files — miss one and it's a runtime error in production. Renaming a dataclass field highlights every broken usage instantly.
> - **Self-documenting:** `def transform(record: Order)` tells the reader exactly what fields are available without reading docs.

```python
def transform_dict(record: dict) -> dict:
    return record  # what keys does record have? Must read docs or trace the code

def transform_typed(record: Order) -> Order:
    return record  # IDE shows: Order has .customer_id, .amount
```

#### Dict — no validation

> [!warning] Dict Accepts Any Garbage
>
> - **Dict:** `{"customer_id": "not_a_number", "amount": "free"}` — no error at any point.
> - **Dataclass:** type hints help the IDE catch type mismatches, but no runtime enforcement.
> - **Pydantic:** runtime validation that auto-converts valid data and rejects bad data with clear error messages.

```python
bad_dict = {"customer_id": "not_a_number", "amount": "free"}  # no error!
```

#### When to use what

```python
# When to use what — dict vs dataclass vs class decision guide

recs = """
USE CASE                        RECOMMENDATION
─────────────────────────────── ──────────────────────────
Quick script / notebook          dict
Pandas / Spark data processing   DataFrame (not classes)
SQL queries                      SQL results (not classes)
Pipeline config                  @dataclass or Pydantic
API request/response             Pydantic (validates input)
Pipeline metadata / state        @dataclass
Task queue messages              @dataclass
Logging / error reports          @dataclass
Shared library / team code       @dataclass (self-documenting)
Unknown/dynamic JSON schema      dict (can't define class upfront)
"""
recs
```

    
    ─────────────────────────────── ──────────────────────────
    Quick script / notebook          dict
    Pandas / Spark data processing   DataFrame (not classes)
    SQL queries                      SQL results (not classes)
    Pipeline config                  @dataclass or Pydantic
    API request/response             Pydantic (validates input)
    Pipeline metadata / state        @dataclass
    Task queue messages              @dataclass
    Logging / error reports          @dataclass
    Shared library / team code       @dataclass (self-documenting)
    Unknown/dynamic JSON schema      dict (can't define class upfront)

#### @dataclass declarations

The `@dataclass` decorator automatically generates `__init__`, `__repr__`, `__eq__` and optionally `__hash__` and `__order__` from class field declarations. It eliminates boilerplate for data-holding classes while keeping full IDE autocomplete and type-checker support.

```python
# @dataclass — auto-generated __init__, __repr__, __eq__ from field declarations

@dataclass
class Point:
    x: float
    y: float

p1 = Point(3.0, 4.0)
p2 = Point(3.0, 4.0)
p3 = Point(1.0, 2.0)

p1  # auto __repr__
p1 == p2  # auto __eq__ (compares by value!)
p1 == p3   # p1 == p3
```

    Point(x=3.0, y=4.0)
    True
    False

#### field() — customizing dataclass fields

```python
# field() — customize individual dataclass fields

@dataclass
class Employee:
    name: str                                      # no default -> required for init
    department: str                                # no default -> required for init                     
    salary: float = 50000.0                        # default value -> optional during init
    tags: list[str] = field(default_factory=list)  # mutable default (safe!)
    _id: int = field(init=False, repr=False)       # excluded from __init__ and __repr__

    def __post_init__(self):                       # runs after __init__
        self._id = hash(self.name)                 # computed field

emp = Employee("Alice", "Engineering", 95000, ["senior", "lead"])
emp   # Employee
emp._id   # Hidden _id
```

    Employee(name='Alice', department='Engineering', salary=95000, tags=['senior', 'lead'])
    Hidden _id: -5760575203000102949

#### frozen=True — immutable dataclass

> [!tip] frozen=True for immutability
>
> `@dataclass(frozen=True)` makes instances immutable and hashable — essential for using dataclass instances as dictionary keys or set members. Any attempt to reassign a field raises `FrozenInstanceError`.

```python
# frozen=True — immutable dataclass that raises on assignment

@dataclass(frozen=True)
class Config:
    host: str
    port: int
    ssl: bool = True

config = Config("localhost", 5432)
config
# config.host = "other"  # FrozenInstanceError! Immutable

# Can use as dict key or set element (hashable because frozen)
# hashable = can compute a fixed integer fingerprint (hash) for the object
configs = {config: "primary"}
configs   # As dict key
```

    Config(host='localhost', port=5432, ssl=True)
    {Config(host='localhost', port=5432, ssl=True): 'primary'}

#### order=True — comparable dataclass

```python
# order=True — auto-generated comparison methods for sortable dataclasses

@dataclass(order=True)
# field order in the class IS the sort priority
class Version:
    major: int
    minor: int
    patch: int

versions = [Version(2, 0, 0), Version(1, 9, 5), Version(2, 1, 0)]
sorted(versions)   # Sorted
max(versions)   # Max
```

    [Version(major=1, minor=9, patch=5), Version(major=2, minor=0, patch=0), Version(major=2, minor=1, patch=0)]
    Version(major=2, minor=1, patch=0)

#### PipelineRecord and boilerplate comparison

```python
# PipelineRecord and boilerplate comparison — real-world dataclass usage

@dataclass
class PipelineRecord:
    table_name: str
    row_count: int
    status: str = "pending"
    errors: list[str] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.status == "success" and len(self.errors) == 0

records = [
    PipelineRecord("users", 1000, "success"),
    PipelineRecord("orders", 500, "failed", ["timeout"]),
    PipelineRecord("products", 200),
]
for r in records:
    print(f"  {r.table_name}: {r.status} (ok={r.is_success})")
```

      users: success (ok=True)
      orders: failed (ok=False)
      products: pending (ok=False)

#### Summary — class vs dataclass vs frozen dataclass

```python
# Summary — class vs dataclass boilerplate comparison

# Without @dataclass — 12 lines of boilerplate:
#   class Point:
#       def __init__(self, x, y): ...
#       def __repr__(self): ...
#       def __eq__(self, other): ...
#       def __hash__(self): ...

# With @dataclass: just 3 lines — all methods auto-generated!
```

    
    class Point:
        def __init__(self, x, y):
            self.x = x
            self.y = y
        def __repr__(self):
            return f"Point(x={self.x}, y={self.y})"
        def __eq__(self, other):
            return self.x == other.x and self.y == other.y
        def __hash__(self):
            return hash((self.x, self.y))
    
    With @dataclass: just 3 lines — all methods auto-generated!
