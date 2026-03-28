---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
keywords: [class, inheritance, polymorphism, encapsulation, property, dunder, dataclass, ABC, abstractmethod, super]
description: "Python OOP reference with executable examples and cell outputs — covers classes, inheritance, polymorphism, encapsulation, properties, dataclasses, and abstract base classes. See [[06_cs_oop]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[06_cs_oop]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - Python

```python
import math
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable, Optional
from dataclasses import dataclass, field
```

## Classes & Objects

#### Type definitions

> [!warning] Class definition — blueprint with __init__, attributes, methods, __str__
> Class definition — blueprint with __init__, attributes, methods, __str__
>
> Technique: class Dog: defines a type. __init__ initializes instance
>   attributes (self.name). Class attributes (species) are shared by all.
>   __str__ returns human-readable string for print() and f-strings.
>
> Benefits:
>   - Class attributes shared across instances — no duplication
>   - __init__ ensures objects start in a valid state
>   - __str__/__repr__ provide clean display and debugging output
>
> Anti-patterns:
>   - Mutable class attributes (lists/dicts) — shared and mutated by all instances
>   - Not defining __repr__ — defaults to unhelpful <Dog at 0x...>
>   - __init__ doing heavy work — use factory methods for complex setup
>
> When to use:
>   - Domain entities with state and behavior
>
> When NOT to use:
>   - Simple data containers — use dataclass or namedtuple
>
> Classes and objects — class is the blueprint; instances are created with ClassName()
>
> Dog — class attribute shared by all, instance attributes unique to each, methods operate on self

```python
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

#### Using Dog — instance and class attributes

```python
# Using classes — instantiation, attribute access, method calls

dog1 = Dog("Rex", 5)
dog2 = Dog("Buddy", 3)

print(f"dog1:        {dog1}")                    # calls __str__
print(f"dog1.name:   {dog1.name}")               # access attribute
print(f"dog1.bark(): {dog1.bark()}")             # call method
print(f"species:     {dog1.species}")             # class attribute (shared)
print(f"older?:      {dog1.is_older_than(dog2)}")

dog1.color = "brown"                              # works because we declared it in __init__
print(f"dog1.color:  {dog1.color}")
print(f"dog2.color:  {dog2.color}")                # None — default from __init__
```

    dog1:        Dog(Rex, age=5)
    dog1.name:   Rex
    dog1.bark(): Rex says Woof!
    species:     Canis familiaris
    older?:      True
    dog1.color:  brown
    dog2.color:  None

#### Class vs instance attribute shadowing

```python
# Class vs instance attribute shadowing — shared vs per-instance state

print(f"Dog.species:  {Dog.species}")             # access on class
print(f"dog1.species: {dog1.species}")            # access on instance (falls back to class)

dog1.species = "Modified"                         # creates INSTANCE attribute, doesn't change class
print(f"dog1.species: {dog1.species}")            # "Modified" (instance)
print(f"dog2.species: {dog2.species}")            # still "Canis familiaris" (class)
print(f"Dog.species:  {Dog.species}")             # still "Canis familiaris" (class)
```

    Dog.species:  Canis familiaris
    dog1.species: Canis familiaris
    dog1.species: Modified
    dog2.species: Canis familiaris
    Dog.species:  Canis familiaris

<h4><code style="font-size:0.75em">@property</code> — controlled access with validation</h4>

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
print(f"radius: {c.radius}")                     # calls getter (no parentheses!)
print(f"area:   {c.area:.2f}")                    # computed, read-only
c.radius = 10                                     # calls setter (validates)
print(f"new radius: {c.radius}")
# c.radius = -1  # ValueError!
# c.area = 100   # AttributeError! No setter defined
```

    radius: 5
    area:   78.54
    new radius: 10

## Inheritance & Polymorphism

#### Type definitions

> [!warning] Inheritance — base class with methods, derived classes override
> Inheritance — base class with methods, derived classes override
>
> Technique: class Dog(Animal) inherits from Animal. Override methods
>   by redefining them. super().__init__() calls parent constructor.
>   Python supports multiple inheritance via MRO (C3 linearization).
>
> Benefits:
>   - Code reuse — shared behavior in the base class
>   - Polymorphism — derived types substitutable for the base type
>   - super() handles MRO correctly in multiple inheritance
>
> Anti-patterns:
>   - Deep hierarchies (>3 levels) — prefer composition
>   - Forgetting super().__init__() — parent state not initialized
>   - Diamond inheritance without understanding MRO — confusing dispatch
>
> When to use:
>   - IS-A relationships: Dog is an Animal, Circle is a Shape
>
> When NOT to use:
>   - HAS-A relationships — use composition (attributes)
>
> Inheritance and polymorphism — child classes extend a parent; method overriding enables runtime dispatch
>
> Animal — base class with speak that subclasses can override

```python
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

#### Using inheritance

```python
# Using inheritance — instantiate subclasses, call overridden methods

dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

print(f"dog.speak():  {dog.speak()}")      # inherited from Animal
print(f"dog.fetch():  {dog.fetch()}")      # Dog-specific
print(f"cat.speak():  {cat.speak()}")      # overridden version
print(f"dog.breed:    {dog.breed}")
```

    dog.speak():  Rex says Woof!
    dog.fetch():  Rex fetches the ball!
    cat.speak():  Whiskers says Meow... when it feels like it.
    dog.breed:    German Shepherd

#### Polymorphism and type checking

```python
# Polymorphism and type checking — duck typing and isinstance

def animal_roll_call(animals):
    """Works with ANY Animal — doesn't care which specific type."""
    for animal in animals:
        print(f"  {animal}: {animal.speak()}")

animals = [Dog("Rex", "Shepherd"), Cat("Whiskers"), Dog("Buddy", "Lab")]
animal_roll_call(animals)                  # each calls its own speak()

print(f"isinstance(dog, Dog):    {isinstance(dog, Dog)}")      # True
print(f"isinstance(dog, Animal): {isinstance(dog, Animal)}")   # True (Dog IS an Animal)
print(f"isinstance(cat, Dog):    {isinstance(cat, Dog)}")      # False
print(f"issubclass(Dog, Animal): {issubclass(Dog, Animal)}")   # True
```

      Dog(Rex): Rex says Woof!
      Cat(Whiskers): Whiskers says Meow... when it feels like it.
      Dog(Buddy): Buddy says Woof!
    isinstance(dog, Dog):    True
    isinstance(dog, Animal): True
    isinstance(cat, Dog):    False
    issubclass(Dog, Animal): True

#### Mixin

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
print(f"speak: {duck.speak()}")
print(f"fly:   {duck.fly()}")
print(f"swim:  {duck.swim()}")
print(f"MRO:   {[c.__name__ for c in Duck.__mro__]}") # Method Resolution Order (from left to right)
```

    speak: Donald says Quack!
    fly:   Donald is flying!
    swim:  Donald is swimming!
    MRO:   ['Duck', 'Animal', 'Flyable', 'Swimmable', 'object']

## Abstract Classes & Interfaces

#### Abstract class

> [!warning] Abstract class (ABC) — enforced contract with optional shared implementation
> Abstract class (ABC) — enforced contract with optional shared implementation
>
> Technique: class Shape(ABC) with @abstractmethod defines methods that
>   subclasses must implement. Concrete methods provide shared logic.
>   Instantiating an abstract class raises TypeError.
>
> Benefits:
>   - Enforces contract — TypeError if abstract method not implemented
>   - Shared code in concrete methods — avoids duplication
>   - Catches missing implementations at instantiation, not at call time
>
> Anti-patterns:
>   - ABC with no shared code — use Protocol for structural typing
>   - Forgetting @abstractmethod — method becomes optional
>   - ABC with too many abstract methods — splits into smaller ABCs
>
> When to use:
>   - When subclasses must share common state and implement specific methods
>
> When NOT to use:
>   - Pure contract — use Protocol for duck-typing compatibility
>
> Abstract class — Shape defines the contract
> subclasses must implement area/perimeter
>
> Shape — abstract base; area and perimeter are abstract, describe is concrete

```python
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

#### Using abstract classes

```python
# Using abstract classes — instantiate subclasses, call abstract methods

rect = Rectangle(5, 3, "red")
circ = Circle(4, "blue")

print(f"rect: {rect.describe()}")
print(f"circ: {circ.describe()}")

# Polymorphism with abstract class
shapes: list[Shape] = [rect, circ]
total_area = sum(s.area() for s in shapes)
print(f"Total area: {total_area:.2f}")
```

    rect: red Rectangle: area=15.00
    circ: blue Circle: area=50.27
    Total area: 65.27

<h4><code style="font-size:0.75em">Protocol</code> — structural typing</h4>

> [!warning] - Third-party classes that can't inherit your ABC
>   - Third-party classes that can't inherit your ABC
>   - Duck typing with type checker support
>
> When NOT to use:
>   - When shared implementation is needed — use ABC instead
>
> Protocol — structural typing; any class with the right methods matches, no inheritance needed
>
> Drawable — any class with a draw() method qualifies

```python
# Protocol — structural typing without inheritance (duck typing formalized)

// When to use:
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
print(f"Button is Drawable? {isinstance(Button(), Drawable)}")  # True!
```

      Drawing button
      Drawing textbox
    Button is Drawable? True

#### Summary — ABC vs Protocol

> [!abstract]- Summary — ABC vs Protocol comparison
> Summary — ABC vs Protocol comparison
>
> ABC:      class must explicitly inherit (class Rect(Shape))
> Protocol: class just needs the right methods (no inheritance)
> ABC:      has concrete methods + abstract methods (partial implementation)
> Protocol: pure contract (just method signatures)
>

    ABC:      class must explicitly inherit (class Rect(Shape))
    Protocol: class just needs the right methods (no inheritance)
    ABC:      has concrete methods + abstract methods (partial implementation)
    Protocol: pure contract (just method signatures)

## Encapsulation & Access Control

#### Access conventions

> [!warning] Encapsulation — naming conventions for access control
> Encapsulation — naming conventions for access control
>
> Technique: Python uses conventions, not enforcement. name is public.
>   _name is protected (convention). __name triggers name mangling
>   (_ClassName__name) — harder to access accidentally.
>
> Benefits:
>   - _prefix signals "internal use" — respected by IDEs and developers
>   - __mangling prevents accidental override in subclasses
>   - @property provides validated access to private backing fields
>
> Anti-patterns:
>   - Accessing _private attrs from outside — violates the convention
>   - Overusing __mangling — makes testing and inheritance harder
>   - No access control at all — public everything loses encapsulation
>
> When to use:
>   - _ for internal implementation details; __ for name-collision prevention
>
> When NOT to use:
>   - __ for privacy alone — _ convention is sufficient in Python
>
> Encapsulation — Python uses naming conventions instead of enforced access modifiers
>
> BankAccount — public (name), protected (_balance), private (__pin via name mangling)

```python
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
print(f"owner:    {acc.owner}")           # public — OK
print(f"_balance: {acc._balance}")        # "protected" — works but shouldn't
# print(acc.__pin)                        # AttributeError! Name mangled
print(f"__pin:    {acc._BankAccount__pin}")  # name mangling — still accessible!  # type: ignore
print(f"dir(acc) with __: {[a for a in dir(acc) if 'pin' in a.lower()]}")
# Shows _BankAccount__pin — Python renamed it
```

    owner:    Alice
    _balance: 1000
    __pin:    1234
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
print(comparison)
print("Python: conventions only — nothing is truly private")
```

    
    name                public              accessible everywhere
    _name               protected           accessible in class + subclasses (convention in Python)
    (no equivalent)     internal            accessible within same assembly/project
    (no equivalent)     protected internal  protected OR internal
    (no equivalent)     private protected   protected AND internal
    
    Python: conventions only — nothing is truly private

## Static & Class Methods

#### Type definitions

> [!warning] Static and class methods — @classmethod receives cls, @staticmethod has no self
> Static and class methods — @classmethod receives cls, @staticmethod has no self
>
> Technique: @classmethod gets the class as first arg (cls) — enables
>   factory methods and inheritance-aware construction. @staticmethod
>   gets no implicit arg — just a function namespaced to the class.
>
> Benefits:
>   - @classmethod factories: Employee.from_csv(line) creates instances
>   - @classmethod respects inheritance — cls is the subclass when called on one
>   - @staticmethod groups utility functions under the class namespace
>
> Anti-patterns:
>   - @staticmethod when a module-level function is clearer
>   - Instance method when self is never used — make it @staticmethod
>   - Not using cls in @classmethod — should be @staticmethod instead
>
> When to use:
>   - @classmethod for factories and inheritance-aware methods
>   - @staticmethod for class-namespaced utilities
>
> When NOT to use:
>   - @staticmethod for methods that need instance state — use regular method
>
> Static and class methods — @classmethod receives cls for factories; @staticmethod has no self/cls
>
> Employee — instance method (self), @classmethod (cls), @staticmethod (no self/cls)

```python
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

#### Using static and class methods

```python
# Using static and class methods — factories and aggregate operations

emp1 = Employee("Alice", 95000)
emp1.give_raise(10)
print(f"Instance: {emp1}")

# Class method — called on the class, creates an object
emp2 = Employee.from_string("Bob,85000")
print(f"Factory:  {emp2}")

# Static method — no instance needed
print(f"Static:   valid salary? {Employee.is_valid_salary(50000)}")
print(f"Static:   valid salary? {Employee.is_valid_salary(-100)}")

# Class attribute
print(f"Count:    {Employee.get_count()} employees")
print(f"Company:  {Employee.company}")
```

    Instance: Alice @ Acme Corp: $104,500
    Factory:  Bob @ Acme Corp: $85,000
    Static:   valid salary? True
    Static:   valid salary? False
    Count:    2 employees
    Company:  Acme Corp

<h4><code style="font-size:0.75em">@classmethod</code> inheritance — cls is the subclass</h4>

```python
# @classmethod inheritance — cls is the subclass, enabling polymorphic factories

class Manager(Employee):
    pass

# cls is Manager, not Employee — creates a Manager object!
mgr = Manager.from_string("Charlie,120000")
print(f"Type: {type(mgr).__name__}")       # Manager, not Employee
# If from_string used @staticmethod with Employee(), it would always create Employee
```

    Type: Manager

## Dataclasses & Records

#### Why dataclasses instead of dicts

> [!danger] Why dataclasses over dicts — compile-time safety for known structures
> Why dataclasses over dicts — compile-time safety for known structures
>
> Technique: Dicts accept any key (including typos) and any value type —
>   errors appear only at runtime. Dataclasses enforce field names and
>   types at definition, with IDE autocomplete and type checker support.
>
> Benefits:
>   - Typos caught by IDE and type checker — not at runtime
>   - Autocomplete lists all valid fields — no memorizing string keys
>   - Refactoring tools rename fields across the codebase
>
> Anti-patterns:
>   - Dicts for fixed-structure data — loses safety and tooling
>   - String keys when field names are known — dataclass is type-safe
>
> When to use:
>   - Any data with a known schema: API responses, configs, DB rows
>
> When NOT to use:
>   - Truly dynamic keys from runtime — dicts are appropriate
>
> In data pipelines, all data ends up serialized (JSON, Parquet, CSV) and stored
> in databases. So why bother with classes for moving data around?
>
> SHORT ANSWER: dataclasses aren't for the DATA itself (that flows through
> pandas/Spark/SQL). They're for everything AROUND the data: configs, metadata,
> API responses, pipeline state, error reports, task definitions.
>
> WHEN DICTS WIN:
> - Exploratory/ad-hoc work, notebooks
> - Unknown/dynamic schemas (arbitrary JSON from external API)
> - Pandas DataFrames (already structured)
> - Quick scripts you'll run once
>
> WHEN DATACLASSES WIN:
> - Production pipelines that run unattended (typos = 3am failures)
> - Shared code between team members (self-documenting)
> - Anything that gets deployed and must not fail silently
> - APIs (input/output contracts)
> - Configs, metadata, pipeline orchestration state
>

#### Dict — silent typos

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

print(f"Dict typo:      silent bug (amout instead of amount)")
print(f"Dataclass typo: TypeError at creation time")
```

    Dict typo:      silent bug (amout instead of amount)
    Dataclass typo: TypeError at creation time

#### Autocomplete, refactoring, and type safety

```python
# Autocomplete, refactoring, and type safety — IDE benefits of dataclasses

def transform_dict(record: dict) -> dict:
    # What keys does record have? Must read docs or trace the code.
    return record

def transform_typed(record: Order) -> Order:
    # IDE shows: Order has .customer_id, .amount — self-documenting
    return record

print("Dict:      no autocomplete, must memorize keys")
print("Dataclass: IDE shows all fields on '.'")
print("Dict:      search-and-replace 'customer_id' strings across all files")
print("           miss one? Runtime error in production")
print("Dataclass: rename the field → IDE highlights every broken usage")
```

    Dict:      no autocomplete, must memorize keys
    Dataclass: IDE shows all fields on '.'
    Dict:      search-and-replace 'customer_id' strings across all files
               miss one? Runtime error in production
    Dataclass: rename the field → IDE highlights every broken usage

#### Dict — no validation

```python
# Dict vs dataclass — dicts have no type validation

bad_dict = {"customer_id": "not_a_number", "amount": "free"}  # no error!

# Dataclass — at least type hints help IDE catch it
# With Pydantic — actual runtime validation:
print("Dict:      any garbage in, no error")
print("Dataclass: type hints + IDE catch mistakes")
print("Pydantic:  runtime validation (auto-converts and rejects bad data)")
```

    Dict:      any garbage in, no error
    Dataclass: type hints + IDE catch mistakes
    Pydantic:  runtime validation (auto-converts and rejects bad data)

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
print(recs)
```

    
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

<h4><code style="font-size:0.75em">@dataclass</code> declarations</h4>

```python
# @dataclass — auto-generated __init__, __repr__, __eq__ from field declarations

@dataclass
class Point:
    x: float
    y: float

p1 = Point(3.0, 4.0)
p2 = Point(3.0, 4.0)
p3 = Point(1.0, 2.0)

print(f"p1:        {p1}")                     # auto __repr__
print(f"p1 == p2:  {p1 == p2}")               # auto __eq__ (compares by value!)
print(f"p1 == p3:  {p1 == p3}")
```

    p1:        Point(x=3.0, y=4.0)
    p1 == p2:  True
    p1 == p3:  False

<h4><code style="font-size:0.75em">field()</code> — customizing dataclass fields</h4>

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
print(f"Employee: {emp}")
print(f"Hidden _id: {emp._id}")
```

    Employee: Employee(name='Alice', department='Engineering', salary=95000, tags=['senior', 'lead'])
    Hidden _id: -5760575203000102949

<h4><code style="font-size:0.75em">frozen=True</code> — immutable dataclass</h4>

```python
# frozen=True — immutable dataclass that raises on assignment

@dataclass(frozen=True)
class Config:
    host: str
    port: int
    ssl: bool = True

config = Config("localhost", 5432)
print(f"Config: {config}")
# config.host = "other"  # FrozenInstanceError! Immutable

# Can use as dict key or set element (hashable because frozen)
# hashable = can compute a fixed integer fingerprint (hash) for the object
configs = {config: "primary"}
print(f"As dict key: {configs}")
```

    Config: Config(host='localhost', port=5432, ssl=True)
    As dict key: {Config(host='localhost', port=5432, ssl=True): 'primary'}

<h4><code style="font-size:0.75em">order=True</code> — comparable dataclass</h4>

```python
# order=True — auto-generated comparison methods for sortable dataclasses

@dataclass(order=True)
# field order in the class IS the sort priority
class Version:
    major: int
    minor: int
    patch: int

versions = [Version(2, 0, 0), Version(1, 9, 5), Version(2, 1, 0)]
print(f"Sorted: {sorted(versions)}")
print(f"Max:    {max(versions)}")
```

    Sorted: [Version(major=1, minor=9, patch=5), Version(major=2, minor=0, patch=0), Version(major=2, minor=1, patch=0)]
    Max:    Version(major=2, minor=1, patch=0)

<h4><code style="font-size:0.75em">PipelineRecord</code> and boilerplate comparison</h4>

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

print("""
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
""")
print("With @dataclass: just 3 lines — all methods auto-generated!")
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
