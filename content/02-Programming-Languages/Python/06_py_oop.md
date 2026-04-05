---
title: "06. Object-Oriented Programming - Python"
tags:
  - python
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
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

Python OOP organises code into classes, inheritance hierarchies, abstract base classes, and dataclasses. This page covers all core constructs with executable examples — from basic class definition through to dataclasses and records.

```python
import math
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable, Optional
from dataclasses import dataclass, field
```

## Classes & Objects

Classes are Python's primary mechanism for encapsulating state (attributes) and behavior (methods). `__init__` initializes instance attributes, class attributes are shared by all instances, and dunder methods (`__str__`, `__repr__`) control string representation. Python uses dynamic attribute access and duck typing — any object with the right methods works, regardless of its class hierarchy.

### Class definition and usage

Defining classes with `__init__`, instance/class attributes, and dunder methods, then creating and using instances.

#### Class definition — __init__, attributes, __str__

Defines the `Dog` class with a class attribute (`species`), `__init__` for instance attributes, instance methods, and `__str__`/`__repr__` dunder methods. Python has no auto-properties — all attributes are set explicitly in `__init__`.

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

> [!success] Best practices
>
> - Use immutable class attributes (strings, numbers, tuples) or define mutable defaults inside `__init__` (`self.items = []`)
> - Always define both `__repr__` (unambiguous, for debugging) and `__str__` (human-readable)
> - Keep `__init__` to attribute assignment only; use `@classmethod` factories for complex construction

```python
class Dog:
    species = "Canis familiaris"

    def __init__(self, name, age):
        self.name = name
        self.age = age
        self.color: str | None = None

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

Creates two `Dog` instances and exercises attribute access, method calls, class attribute access, and dynamic attribute assignment. `dog2.color` returns `None` because it was never assigned on that instance.

```python
dog1 = Dog("Rex", 5)
dog2 = Dog("Buddy", 3)

print(dog1)
print(dog1.name)
print(dog1.bark())
print(dog1.species)
print(dog1.is_older_than(dog2))

dog1.color = "brown"
print(dog1.color)
print(dog2.color)
```

```text
Dog(Rex, age=5)
Rex
Rex says Woof!
Canis familiaris
True
brown
None
```

#### Class vs instance attribute shadowing

Assigning to an instance attribute with the same name as a class attribute creates a per-instance shadow — the class attribute remains unchanged. Other instances still see the original class attribute.

```python
print(Dog.species)
print(dog1.species)

dog1.species = "Modified"
print(dog1.species)
print(dog2.species)
print(Dog.species)
```

```text
'Canis familiaris'
'Canis familiaris'
'Modified'
'Canis familiaris'
'Canis familiaris'
```

#### @property — controlled access with validation

The `@property` decorator turns a method into an attribute-style accessor with optional validation. The getter looks like `obj.radius` (no parentheses), but runs validation code behind the scenes. Pair with `@name.setter` for write access.

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius can't be negative")
        self._radius = value

    @property
    def area(self):
        return math.pi * self._radius ** 2

c = Circle(5)
print(c.radius)
print(f"{c.area:.2f}")
c.radius = 10
print(c.radius)
```

> [!info] Property Validation
>
> Setters with validation raise exceptions for invalid values. Read-only properties (no setter) raise `AttributeError` on assignment.

```text
5
'78.54'
10
```

## Inheritance & Polymorphism

Inheritance lets a child class acquire all attributes and methods of a parent class and extend or override them. Python supports multiple inheritance (resolved via MRO — C3 linearization). Polymorphism works via duck typing — no base class required; if it has the right methods, it works.

### Inheritance fundamentals

Defining parent/child relationships with `class Child(Parent)`, calling parent methods with `super()`, and overriding methods.

#### Inheritance — base class, super().__init__, method override

A child class acquires all attributes and methods of a parent class and can extend or override them. Python supports multiple inheritance (a class can have multiple parents), resolved via the Method Resolution Order (MRO).

> [!warning] Diamond inheritance — multiple parents sharing a grandparent
>
> With multiple inheritance, if two parents share a grandparent, methods could be called twice. Python's MRO (C3 linearization) prevents this, but the order may surprise you. Check with `ClassName.__mro__`.

> [!success] Verify the MRO before relying on multiple inheritance
>
> Print `ClassName.__mro__` to confirm the resolution order. Use `super()` consistently in every class in the hierarchy — this ensures C3 linearization works correctly and each `__init__` is called exactly once.

`class Dog(Animal)` inherits from `Animal`. Override methods by redefining them; `super().__init__()` calls the parent constructor. Python supports multiple inheritance via MRO (C3 linearization). Use inheritance for IS-A relationships; prefer composition (attributes) for HAS-A.

> [!warning] Anti-patterns
>
> - **Deep hierarchies** (>3 levels) — prefer composition
> - **Forgetting `super().__init__()`** — parent state not initialized
> - **Diamond inheritance** without understanding MRO — confusing dispatch

> [!success] Prefer composition for HAS-A relationships
>
> If a class needs the capability of another but isn't fundamentally a subtype, compose: `class Pipeline: def __init__(self): self.logger = Logger()`. Reserve inheritance for true IS-A relationships where the Liskov Substitution Principle holds.

```python
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound

    def speak(self):
        return f"{self.name} says {self.sound}!"

    def __str__(self):
        return f"{type(self).__name__}({self.name})"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Woof")
        self.breed = breed

    def fetch(self):
        return f"{self.name} fetches the ball!"

class Cat(Animal):
    def __init__(self, name):
        super().__init__(name, "Meow")

    def speak(self):
        return f"{self.name} says {self.sound}... when it feels like it."
```

#### Using inheritance — subclass instantiation and polymorphic calls

Creates `Dog` and `Cat` instances and calls both inherited and overridden methods, showing that `cat.speak()` returns the `Cat`-specific version while `dog.speak()` uses the default from `Animal`.

```python
dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

print(dog.speak())
print(dog.fetch())
print(cat.speak())
print(dog.breed)
```

```text
'Rex says Woof!'
'Rex fetches the ball!'
'Whiskers says Meow... when it feels like it.'
'German Shepherd'
```

### Polymorphism and type checking

Polymorphism in Python works via duck typing — no base class or interface required. If it has the right method, it works. `isinstance()` and `issubclass()` test the actual type hierarchy at runtime.

#### Polymorphism — duck typing and isinstance

Calls `animal_roll_call` with a mixed list — Python dispatches to each object's own `speak()` via duck typing, no explicit base type required. `isinstance()` and `issubclass()` test the actual type hierarchy at runtime.

```python
def animal_roll_call(animals):
    for animal in animals:
        print(f"  {animal}: {animal.speak()}")

animals = [Dog("Rex", "Shepherd"), Cat("Whiskers"), Dog("Buddy", "Lab")]
animal_roll_call(animals)

print(isinstance(dog, Dog))
print(isinstance(dog, Animal))
print(isinstance(cat, Dog))
print(issubclass(Dog, Animal))
```

```text
  Dog(Rex): Rex says Woof!
  Cat(Whiskers): Whiskers says Meow... when it feels like it.
  Dog(Buddy): Buddy says Woof!
True
True
False
True
```

#### Mixin classes — add capabilities via multiple inheritance

A mixin is a class designed to be combined with other classes via multiple inheritance, adding a specific capability (logging, serialization, comparison) without being a standalone base class. Mixins have no `__init__` of their own and assume the host class provides certain attributes.

A mixin is a class designed to be combined via multiple inheritance, adding a specific capability without being a standalone base class. Mixins have no `__init__` and assume the host class provides certain attributes.

```python
class Flyable:
    name: str
    def fly(self):
        return f"{self.name} is flying!"

class Swimmable:
    name: str
    def swim(self):
        return f"{self.name} is swimming!"

class Duck(Animal, Flyable, Swimmable):
    def __init__(self, name):
        super().__init__(name, "Quack")

duck = Duck("Donald")
print(duck.speak())
print(duck.fly())
print(duck.swim())
print([c.__name__ for c in Duck.__mro__])
```

```text
'Donald says Quack!'
'Donald is flying!'
'Donald is swimming!'
['Duck', 'Animal', 'Flyable', 'Swimmable', 'object']
```

## Abstract Classes & Interfaces

Python provides two mechanisms for defining contracts: `ABC` (Abstract Base Class) with `@abstractmethod` for contracts with shared implementation, and `Protocol` for structural typing without inheritance. ABCs require explicit inheritance; Protocols work via duck typing — any class with the right methods matches.

### Abstract base classes (ABC)

`ABC` requires explicit inheritance (`class Shape(ABC)`) and marks abstract methods with `@abstractmethod`. Instantiating an abstract class directly raises `TypeError`. For structural typing without inheritance, use `Protocol` instead (see below).

#### Abstract class

Declares `Shape` as an ABC with two `@abstractmethod` stubs (`area`, `perimeter`) and a concrete `describe()` method. `Rectangle` and `Circle` subclass `Shape` and implement both abstract methods.

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

> [!success] Use ABC for shared implementation, Protocol for contracts
>
> If the base class provides shared methods (like `describe()` above), use `ABC`. If you only need a structural contract with no shared code — especially for third-party classes — use `@runtime_checkable Protocol` instead. Keep ABCs focused: 2-4 abstract methods is usually the right size.

```python
class Shape(ABC):
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

class Rectangle(Shape):
    def __init__(self, width, height, color="black"):
        super().__init__(color)
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

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

Instantiates `Rectangle` and `Circle` and calls the concrete `describe()` method, which internally dispatches to each subclass's `area()`. A generator expression sums total area across both shapes.

```python
rect = Rectangle(5, 3, "red")
circ = Circle(4, "blue")

print(rect.describe())
print(circ.describe())

shapes: list[Shape] = [rect, circ]
total_area = sum(s.area() for s in shapes)
print(f"{total_area:.2f}")
```

```text
'red Rectangle: area=15.00'
'blue Circle: area=50.27'
'65.27'
```

### Protocol — structural typing

A `Protocol` defines methods a class must have, checked by type checkers (mypy) without requiring explicit inheritance. Python's answer to Go interfaces — "if it quacks like a duck." Classes satisfy a Protocol by having the right methods with the right signatures. Use `@runtime_checkable` to enable `isinstance()` checks.

#### Protocol declaration and usage

Declares `Drawable` as a `@runtime_checkable Protocol`. `Button` and `TextBox` satisfy it without inheriting from it — any class with a matching `draw() -> str` method qualifies. `render()` accepts anything that matches the protocol signature.

```python
@runtime_checkable
class Drawable(Protocol):
    def draw(self) -> str: ...

class Button:
    def draw(self) -> str:
        return "Drawing button"

class TextBox:
    def draw(self) -> str:
        return "Drawing textbox"

def render(widget: Drawable):
    print(f"  {widget.draw()}")

render(Button())
render(TextBox())
print(isinstance(Button(), Drawable))
```

```text
  Drawing button
  Drawing textbox
True
```

| Feature | ABC | Protocol |
|---|---|---|
| Inheritance | Explicit: `class Rect(Shape)` | None needed — just have the right methods |
| Methods | Concrete + abstract (partial implementation) | Pure contract (just signatures) |

## Encapsulation & Access Control

Python uses naming conventions, not enforcement, for access control: `name` is public, `_name` is protected (convention), and `__name` triggers name mangling to prevent accidental override in subclasses. `@property` provides validated access to private backing fields.

### Naming conventions and name mangling

#### Encapsulation — public, _protected, __private name mangling

Python uses conventions, not enforcement: `name` is public, `_name` is protected (convention), and `__name` triggers name mangling (`_ClassName__name`) to prevent accidental override in subclasses. `@property` provides validated access to private backing fields. Use `_` for internal implementation details and `__` only for name-collision prevention — `__` for privacy alone is overkill.

> [!warning] Anti-patterns
>
> - **Accessing `_private` attrs from outside** — violates the convention
> - **Overusing `__mangling`** — makes testing and inheritance harder
> - **No access control at all** — public everything loses encapsulation

> [!success] Use single underscore for internal state, @property for validated access
>
> Prefix internal attributes with `_` and expose them through `@property` with a setter that validates. Reserve `__` name mangling only for attributes that must survive subclass overrides — this keeps the class testable and subclassable.

```python
class BankAccount:
    def __init__(self, owner, balance):
        self.owner = owner
        self._balance = balance
        self.__pin = 1234

    def deposit(self, amount):
        if amount > 0:
            self._balance += amount

    def get_balance(self):
        return self._balance

    def __validate_pin(self, pin):
        return pin == self.__pin

acc = BankAccount("Alice", 1000)
print(acc.owner)
print(acc._balance)
print(acc._BankAccount__pin)  # type: ignore
print([a for a in dir(acc) if 'pin' in a.lower()])
```

```text
'Alice'
1000
1234
['_BankAccount__pin', '_BankAccount__validate_pin']
```

#### Access comparison

| Python convention | C# modifier | Visible to |
|---|---|---|
| `name` | `public` | Everywhere |
| `_name` | `protected` | Class + subclasses (convention in Python) |
| `__name` | `private` | Same class only (name mangling in Python) |
| (no equivalent) | `internal` | Same assembly/project |
| (no equivalent) | `protected internal` | Protected OR internal |
| (no equivalent) | `private protected` | Protected AND internal |

> [!info] Python has conventions, not enforcement
> Nothing is truly private in Python — `__name` is just renamed to `_ClassName__name`. The convention is the contract.

#### __slots__ — restrict attributes and reduce memory usage

`__slots__` restricts a class to a fixed set of attributes, preventing dynamic attribute creation via `__dict__`. This reduces memory usage by ~40% for classes with many instances (e.g., millions of price records). Any attempt to set an attribute not listed in `__slots__` raises `AttributeError`.

> [!warning] __slots__ disables dynamic attributes
>
> With `__slots__`, you cannot add arbitrary attributes at runtime (`obj.new_attr = 1` raises `AttributeError`). Subclasses without their own `__slots__` reintroduce `__dict__`, negating the memory savings. If you need both slots and dataclass, use `@dataclass(slots=True)` (Python 3.10+).

> [!success] Use @dataclass(slots=True) for modern slotted data classes
>
> In Python 3.10+, `@dataclass(slots=True)` automatically generates `__slots__` from field annotations, giving the memory benefit without manual slot maintenance. For high-volume instances (millions of price records), this reduces per-instance overhead by ~40%.

## Static & Class Methods

`@classmethod` receives `cls` as first argument — enables factory methods and inheritance-aware construction. `@staticmethod` gets no implicit argument — just a function namespaced to the class. Use `@classmethod` for factories; `@staticmethod` for pure utilities.

### @staticmethod and @classmethod

#### @staticmethod and @classmethod — definition and factory methods

Declares the `Employee` class with a `@classmethod` factory (`from_string`), a `@classmethod` counter (`get_count`), and a `@staticmethod` validator (`is_valid_salary`). `@classmethod` receives `cls` and is used for factories and inheritance-aware construction; `@staticmethod` receives no implicit argument.

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

> [!success] Choose the right method type by what the method uses
>
> If the method uses `self` → instance method. If it uses `cls` (or creates new instances) → `@classmethod`. If it uses neither → `@staticmethod` (or move it to module level if it doesn't conceptually belong to the class).

```python
class Employee:
    company = "Acme Corp"
    _employee_count = 0

    def __init__(self, name, salary):
        self.name = name
        self.salary = salary
        Employee._employee_count += 1

    def give_raise(self, percent):
        self.salary *= (1 + percent / 100)
        return self.salary

    @classmethod
    def from_string(cls, data_string):
        name, salary = data_string.split(",")
        return cls(name, float(salary))

    @classmethod
    def get_count(cls):
        return cls._employee_count

    @staticmethod
    def is_valid_salary(salary):
        return salary > 0

    def __str__(self):
        return f"{self.name} @ {self.company}: ${self.salary:,.0f}"
```

#### Using @staticmethod and @classmethod — calls and inheritance

Creates two `Employee` instances — one via the constructor, one via the `from_string` factory — applies a raise, then reads the class attribute, instance counter, and static validator.

```python
emp1 = Employee("Alice", 95000)
emp1.give_raise(10)
print(emp1)

emp2 = Employee.from_string("Bob,85000")
print(emp2)

print(Employee.is_valid_salary(50000))
print(Employee.is_valid_salary(-100))

print(f"Count:    {Employee.get_count()} employees")
print(Employee.company)
```

```text
Alice @ Acme Corp: $104,500
Bob @ Acme Corp: $85,000
True
False
'Count:    2 employees'
'Acme Corp'
```

#### @classmethod inheritance — cls is the subclass

When a subclass calls an inherited `@classmethod`, `cls` is the subclass — the factory creates the correct type automatically. This is why `@classmethod` is preferred over `@staticmethod` for factory methods.

```python
class Manager(Employee):
    pass

mgr = Manager.from_string("Charlie,120000")
print(type(mgr).__name__)
```

```text
'Manager'
```

## Dataclasses & Records

`@dataclass` auto-generates `__init__`, `__repr__`, `__eq__` and optionally `__hash__` and `__order__` from field declarations. It eliminates boilerplate while providing IDE autocomplete and type-checker support. `frozen=True` makes instances immutable and hashable. `order=True` enables sorting. Dataclasses are Python's equivalent of C# records.

### Dataclasses vs Dicts

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

A dict key typo (`"amout"` instead of `"amount"`) raises no error at assignment time — the `KeyError` only surfaces when the key is accessed, potentially far away in the pipeline. The `Order` dataclass raises `TypeError` immediately at construction when an unexpected keyword is passed.

```python
record = {"customer_id": 123, "amout": 99.99}
# total = record["amount"]                          # KeyError in production!

@dataclass
class Order:
    customer_id: int
    amount: float
# order = Order(customer_id=123, amout=99.99)      # TypeError IMMEDIATELY
order = Order(customer_id=123, amount=99.99)

```

```text
Dict typo: silent bug (amout instead of amount) → KeyError at runtime
Dataclass typo: TypeError at creation time
```

#### Autocomplete, refactoring, and type safety

Contrasts two function signatures: one accepting `dict` (no IDE hints — must read docs or trace the call to know what keys exist) vs one accepting a typed `Order` (IDE shows `.customer_id`, `.amount` on autocomplete).

> [!tip] Dataclass IDE Advantages Over Dict
>
> - **Autocomplete:** Dict keys must be memorized. Dataclass fields show on `.` in the IDE.
> - **Refactoring:** Renaming a dict key requires search-and-replace across all files — miss one and it's a runtime error in production. Renaming a dataclass field highlights every broken usage instantly.
> - **Self-documenting:** `def transform(record: Order)` tells the reader exactly what fields are available without reading docs.

```python
def transform_dict(record: dict) -> dict:
    return record

def transform_typed(record: Order) -> Order:
    return record
```

#### Dict — no validation

Constructs a dict with a string value where a number is logically expected — Python raises no error. Dataclasses with type hints surface the mismatch at type-check time (mypy/pyright); Pydantic catches it at runtime with a clear validation error.

> [!warning] Dict Accepts Any Garbage
>
> - **Dict:** `{"customer_id": "not_a_number", "amount": "free"}` — no error at any point.
> - **Dataclass:** type hints help the IDE catch type mismatches, but no runtime enforcement.
> - **Pydantic:** runtime validation that auto-converts valid data and rejects bad data with clear error messages.

> [!success] Use Pydantic for external data, dataclass for internal data
>
> Apply Pydantic `BaseModel` at the boundary (API input, CSV parsing, Kafka messages) where data is untrusted and validation is critical. Use `@dataclass` for internal pipeline state and metadata where you control the construction and want lighter weight.

```python
bad_dict = {"customer_id": "not_a_number", "amount": "free"}
```

#### When to use what

| Use case | Recommendation |
|---|---|
| Quick script / notebook | `dict` |
| Pandas / Spark data processing | DataFrame (not classes) |
| SQL queries | SQL results (not classes) |
| Pipeline config | `@dataclass` or Pydantic |
| API request/response | Pydantic (validates input) |
| Pipeline metadata / state | `@dataclass` |
| Task queue messages | `@dataclass` |
| Logging / error reports | `@dataclass` |
| Shared library / team code | `@dataclass` (self-documenting) |
| Unknown/dynamic JSON schema | `dict` (can't define class upfront) |

### Dataclass declarations and features

Defining dataclasses, using `field()` for customization, `frozen=True` for immutability, and `order=True` for comparisons.

#### @dataclass — auto-generated __init__, __repr__, __eq__

`@dataclass` auto-generates `__init__` from field annotations, a `__repr__` that shows all fields, and value-based `__eq__`. Two `Point` instances with identical coordinates are equal — unlike plain classes where `==` compares object identity.

```python
@dataclass
class Point:
    x: float
    y: float

p1 = Point(3.0, 4.0)
p2 = Point(3.0, 4.0)
p3 = Point(1.0, 2.0)

print(p1)
print(p1 == p2)
print(p1 == p3)
```

```text
Point(x=3.0, y=4.0)
True
False
```

#### field() — customizing dataclass fields

`field()` customizes individual fields: `default_factory` for mutable defaults (lists/dicts), `init=False` to exclude from `__init__`, `repr=False` to hide from `__repr__`. `__post_init__` runs after auto-generated `__init__` for computed fields.

```python
@dataclass
class Employee:
    name: str
    department: str
    salary: float = 50000.0
    tags: list[str] = field(default_factory=list)
    _id: int = field(init=False, repr=False)

    def __post_init__(self):
        self._id = hash(self.name)

emp = Employee("Alice", "Engineering", 95000, ["senior", "lead"])
print(emp)
print(emp._id)
```

```text
Employee(name='Alice', department='Engineering', salary=95000, tags=['senior', 'lead'])
-5760575203000102949
```

#### frozen=True — immutable dataclass

> [!tip] frozen=True for immutability
>
> `@dataclass(frozen=True)` makes instances immutable and hashable — essential for using dataclass instances as dictionary keys or set members. Any attempt to reassign a field raises `FrozenInstanceError`.

`frozen=True` makes instances immutable and hashable — essential for using dataclass instances as dict keys or set members. Any attempt to reassign a field raises `FrozenInstanceError`.

```python
@dataclass(frozen=True)
class Config:
    host: str
    port: int
    ssl: bool = True

config = Config("localhost", 5432)
print(config)

configs = {config: "primary"}
print(configs)
```

```text
Config(host='localhost', port=5432, ssl=True)
{Config(host='localhost', port=5432, ssl=True): 'primary'}
```

#### order=True — comparable dataclass

`order=True` auto-generates `__lt__`, `__le__`, `__gt__`, `__ge__` based on field order in the class declaration — the first field has the highest sort priority.

```python
@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int

versions = [Version(2, 0, 0), Version(1, 9, 5), Version(2, 1, 0)]
print(sorted(versions))
print(max(versions))
```

```text
[Version(major=1, minor=9, patch=5), Version(major=2, minor=0, patch=0), Version(major=2, minor=1, patch=0)]
Version(major=2, minor=1, patch=0)
```

#### PipelineRecord and boilerplate comparison

Dataclasses can include `@property` for computed fields, combining auto-generated boilerplate with custom logic.

```python
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

```text
  users: success (ok=True)
  orders: failed (ok=False)
  products: pending (ok=False)
```

#### Summary — class vs dataclass vs frozen dataclass

| Type | Mutability | Equality | Use for |
|---|---|---|---|
| `class` | Mutable | Identity-based (`is`) | Full OOP with custom behavior |
| `@dataclass` | Mutable | Value-based (`==`) | DTOs, config, events, pipeline state |
| `@dataclass(frozen=True)` | Immutable | Value-based + hashable | Dict keys, set members, immutable config |
| `namedtuple` | Immutable | Value-based + hashable | Lightweight records, tuple unpacking |
