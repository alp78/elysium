---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
keywords: [class, inheritance, polymorphism, encapsulation, property, dunder, dataclass, ABC, abstractmethod, super]
description: "Python OOP reference with executable examples and cell outputs — covers classes, inheritance, polymorphism, encapsulation, properties, dataclasses, and abstract base classes. See [[cs-06_OOP]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-06_OOP]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - Python

## 1. Classes & Objects


```python
# Classes & Objects
#
# KEY CONCEPTS:
# - Class: a blueprint/template for creating objects. Defines attributes (data)
#   and methods (behavior). Like a cookie cutter — the class is the mold, objects are cookies.
# - Object (instance): a specific thing created from a class. Each has its own data.
# - __init__: the constructor — called automatically when creating an object.
#   Sets up the initial state (attributes). C# equivalent: constructor with same name as class.
# - self: the first parameter of every method — refers to the current instance.
#   C# equivalent: 'this' (implicit, not declared as parameter).
# - Attributes: variables that belong to an object (instance attributes) or class (class attributes).
#   C# equivalent: fields and properties.
# - Method: a function defined inside a class that operates on the instance.
# - Python classes are dynamic — you can add/remove attributes at runtime.
#   C# classes are static — all fields must be declared at compile time.

# === Basic class ===
print("=== Basic Class ===")
class Dog:
    # Class attribute — shared by ALL instances
    species = "Canis familiaris"

    # Constructor — called when creating a new Dog()
    def __init__(self, name, age):
        # Instance attributes — unique to each object
        self.name = name               # self = this instance
        self.age = age
        self.color: str | None = None  # declared here to satisfy type checkers (Pylance/mypy)
                                       # Python allows adding attributes dynamically at runtime,
                                       # but static analyzers flag undeclared attributes as errors.

    # Instance method — operates on self
    def bark(self):
        return f"{self.name} says Woof!"

    # Method with parameters
    def is_older_than(self, other):
        return self.age > other.age

    # String representation
    def __str__(self):
        return f"Dog({self.name}, age={self.age})"

    def __repr__(self):
        return f"Dog(name='{self.name}', age={self.age})"

# === Creating objects (instances) ===
dog1 = Dog("Rex", 5)
dog2 = Dog("Buddy", 3)

print(f"dog1:        {dog1}")                    # calls __str__
print(f"dog1.name:   {dog1.name}")               # access attribute
print(f"dog1.bark(): {dog1.bark()}")             # call method
print(f"species:     {dog1.species}")             # class attribute (shared)
print(f"older?:      {dog1.is_older_than(dog2)}")

# === Attributes are dynamic ===
print("\n=== Dynamic Attributes ===")
dog1.color = "brown"                              # works because we declared it in __init__
print(f"dog1.color:  {dog1.color}")
print(f"dog2.color:  {dog2.color}")                # None — default from __init__

# === Instance vs class attributes ===
print("\n=== Instance vs Class Attributes ===")
print(f"Dog.species:  {Dog.species}")             # access on class
print(f"dog1.species: {dog1.species}")            # access on instance (falls back to class)
dog1.species = "Modified"                         # creates INSTANCE attribute, doesn't change class
print(f"dog1.species: {dog1.species}")            # "Modified" (instance)
print(f"dog2.species: {dog2.species}")            # still "Canis familiaris" (class)
print(f"Dog.species:  {Dog.species}")             # still "Canis familiaris" (class)

# === Properties — controlled attribute access ===
print("\n=== Properties (@property) ===")
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
        import math
        return math.pi * self._radius ** 2

c = Circle(5)
print(f"radius: {c.radius}")                     # calls getter (no parentheses!)
print(f"area:   {c.area:.2f}")                    # computed, read-only
c.radius = 10                                     # calls setter (validates)
print(f"new radius: {c.radius}")
# c.radius = -1  # ValueError!
# c.area = 100   # AttributeError! No setter defined
```

    === Basic Class ===
    dog1:        Dog(Rex, age=5)
    dog1.name:   Rex
    dog1.bark(): Rex says Woof!
    species:     Canis familiaris
    older?:      True
    
    === Dynamic Attributes ===
    dog1.color:  brown
    dog2.color:  None
    
    === Instance vs Class Attributes ===
    Dog.species:  Canis familiaris
    dog1.species: Canis familiaris
    dog1.species: Modified
    dog2.species: Canis familiaris
    Dog.species:  Canis familiaris
    
    === Properties (@property) ===
    radius: 5
    area:   78.54
    new radius: 10
    

## 2. Inheritance & Polymorphism


```python
# Inheritance & Polymorphism
#
# KEY CONCEPTS:
# - Inheritance: a class (child) inherits attributes and methods from another class (parent).
#   The child "is a" special version of the parent. Dog is an Animal. Car is a Vehicle.
#   Avoids code duplication — shared behavior goes in the parent, specific behavior in the child.
# - super(): calls the parent's method from the child. Used to extend (not replace) behavior.
# - Method overriding: the child defines a method with the same name as the parent.
#   The child's version runs instead of the parent's. This is polymorphism.
# - Polymorphism ("many forms"): treating different objects through the same interface.
#   A function that expects an Animal can receive a Dog, Cat, or Bird — and each
#   behaves differently when the same method is called.
# - Multiple inheritance: Python allows inheriting from multiple parents.
#   C# does NOT — only single inheritance + interfaces.
# - MRO (Method Resolution Order): the order Python searches for methods in a class hierarchy.
#   Follows C3 linearization. Check with ClassName.__mro__.
# - isinstance(): checks if an object is an instance of a class (or its subclass).
# - issubclass(): checks if a class is a subclass of another.

# === Basic inheritance ===
print("=== Inheritance ===")
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound

    def speak(self):
        return f"{self.name} says {self.sound}!"

    def __str__(self):
        return f"{type(self).__name__}({self.name})"

class Dog(Animal):                         # Dog inherits from Animal
    def __init__(self, name, breed):
        super().__init__(name, "Woof")     # call parent's __init__
        self.breed = breed                 # add Dog-specific attribute

    def fetch(self):                       # Dog-specific method
        return f"{self.name} fetches the ball!"

class Cat(Animal):
    def __init__(self, name):
        super().__init__(name, "Meow")

    def speak(self):                       # OVERRIDE parent's speak
        return f"{self.name} says {self.sound}... when it feels like it."

dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

print(f"dog.speak():  {dog.speak()}")      # inherited from Animal
print(f"dog.fetch():  {dog.fetch()}")      # Dog-specific
print(f"cat.speak():  {cat.speak()}")      # overridden version
print(f"dog.breed:    {dog.breed}")

# === Polymorphism — same interface, different behavior ===
print("\n=== Polymorphism ===")
def animal_roll_call(animals):
    """Works with ANY Animal — doesn't care which specific type."""
    for animal in animals:
        print(f"  {animal}: {animal.speak()}")

animals = [Dog("Rex", "Shepherd"), Cat("Whiskers"), Dog("Buddy", "Lab")]
animal_roll_call(animals)                  # each calls its own speak()

# === isinstance / issubclass ===
print("\n=== Type Checking ===")
print(f"isinstance(dog, Dog):    {isinstance(dog, Dog)}")      # True
print(f"isinstance(dog, Animal): {isinstance(dog, Animal)}")   # True (Dog IS an Animal)
print(f"isinstance(cat, Dog):    {isinstance(cat, Dog)}")      # False
print(f"issubclass(Dog, Animal): {issubclass(Dog, Animal)}")   # True

# === Multiple inheritance (Python only, C# can't do this) ===
print("\n=== Multiple Inheritance (Python only!) ===")
# Mixin: a class that adds a capability, doesn't stand on its own
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

    === Inheritance ===
    dog.speak():  Rex says Woof!
    dog.fetch():  Rex fetches the ball!
    cat.speak():  Whiskers says Meow... when it feels like it.
    dog.breed:    German Shepherd
    
    === Polymorphism ===
      Dog(Rex): Rex says Woof!
      Cat(Whiskers): Whiskers says Meow... when it feels like it.
      Dog(Buddy): Buddy says Woof!
    
    === Type Checking ===
    isinstance(dog, Dog):    True
    isinstance(dog, Animal): True
    isinstance(cat, Dog):    False
    issubclass(Dog, Animal): True
    
    === Multiple Inheritance (Python only!) ===
    speak: Donald says Quack!
    fly:   Donald is flying!
    swim:  Donald is swimming!
    MRO:   ['Duck', 'Animal', 'Flyable', 'Swimmable', 'object']
    

## 3. Abstract Classes & Interfaces


```python
# Abstract Classes & Interfaces (Protocols)
#
# KEY CONCEPTS:
# - Abstract class: a class that CAN'T be instantiated directly — only subclassed.
#   Used to define a common interface that all subclasses must implement.
#   Has abstract methods (no body — child MUST implement) and concrete methods (with body).
# - ABC (Abstract Base Class): Python's abc module provides @abstractmethod decorator.
# - Protocol (Python 3.8+): structural typing — "if it has these methods, it qualifies."
#   No inheritance required. Like C# interfaces but implicit (duck typing).
#   C# equivalent: interface (but C# requires explicit 'implements').
# - Duck typing: "If it walks like a duck and quacks like a duck, it's a duck."
#   Python doesn't care about declared types — only that the right methods exist.
# - Interface vs Abstract class:
#   Interface = pure contract (what methods must exist). No implementation.
#   Abstract class = partial implementation (some methods done, some left for child).

from abc import ABC, abstractmethod

# === Abstract class ===
print("=== Abstract Class ===")
class Shape(ABC):
    """Can't instantiate Shape directly — must subclass."""

    def __init__(self, color="black"):
        self.color = color              # concrete attribute (shared)

    @abstractmethod                     # child MUST implement this
    def area(self) -> float:
        pass

    @abstractmethod
    def perimeter(self) -> float:
        pass

    def describe(self):                 # concrete method (inherited as-is)
        return f"{self.color} {type(self).__name__}: area={self.area():.2f}"

class Rectangle(Shape):
    def __init__(self, width, height, color="black"):
        super().__init__(color)
        self.width = width
        self.height = height

    def area(self) -> float:            # MUST implement
        return self.width * self.height

    def perimeter(self) -> float:       # MUST implement
        return 2 * (self.width + self.height)

class Circle(Shape):
    def __init__(self, radius, color="black"):
        super().__init__(color)
        self.radius = radius

    def area(self) -> float:
        import math
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        import math
        return 2 * math.pi * self.radius

# shape = Shape()  # TypeError! Can't instantiate abstract class
rect = Rectangle(5, 3, "red")
circ = Circle(4, "blue")

print(f"rect: {rect.describe()}")
print(f"circ: {circ.describe()}")

# Polymorphism with abstract class
shapes: list[Shape] = [rect, circ]
total_area = sum(s.area() for s in shapes)
print(f"Total area: {total_area:.2f}")

# === Protocol — structural typing (duck typing formalized) ===
print("\n=== Protocol (structural typing) ===")
from typing import Protocol, runtime_checkable

@runtime_checkable                       # allows isinstance() checks
class Drawable(Protocol):
    """Any class with a draw() method qualifies — no inheritance needed."""
    def draw(self) -> str: ...

class Button:                            # does NOT inherit from Drawable
    def draw(self) -> str:
        return "Drawing button"

class TextBox:                           # does NOT inherit from Drawable
    def draw(self) -> str:
        return "Drawing textbox"

def render(widget: Drawable):            # accepts anything with draw()
    print(f"  {widget.draw()}")

render(Button())                         # works! Button has draw()
render(TextBox())                        # works! TextBox has draw()
print(f"Button is Drawable? {isinstance(Button(), Drawable)}")  # True!

# === Key difference: ABC vs Protocol ===
print("\n=== ABC vs Protocol ===")
print("ABC:      class must explicitly inherit (class Rect(Shape))")
print("Protocol: class just needs the right methods (no inheritance)")
print("ABC:      has concrete methods + abstract methods (partial implementation)")
print("Protocol: pure contract (just method signatures)")
print("C#:       abstract class = ABC, interface = Protocol (but explicit)")
```

    === Abstract Class ===
    rect: red Rectangle: area=15.00
    circ: blue Circle: area=50.27
    Total area: 65.27
    
    === Protocol (structural typing) ===
      Drawing button
      Drawing textbox
    Button is Drawable? True
    
    === ABC vs Protocol ===
    ABC:      class must explicitly inherit (class Rect(Shape))
    Protocol: class just needs the right methods (no inheritance)
    ABC:      has concrete methods + abstract methods (partial implementation)
    Protocol: pure contract (just method signatures)
    C#:       abstract class = ABC, interface = Protocol (but explicit)
    

## 4. Encapsulation & Access Control


```python
# Encapsulation & Access Control
#
# KEY CONCEPTS:
# - Encapsulation: hiding internal data and exposing only what's necessary.
#   Prevents external code from breaking internal state.
# - Python has NO true access modifiers (no private/protected keywords).
#   It uses NAMING CONVENTIONS:
#   _name   = "protected" (convention — don't touch from outside, but nothing stops you)
#   __name  = "private" (name mangling — harder to access, but still possible)
#   name    = public (default, no prefix)
# - C# has real access modifiers enforced by the compiler:
#   public, private, protected, internal, protected internal, private protected.
# - Name mangling: Python transforms __attr into _ClassName__attr to prevent
#   accidental access from subclasses. It's NOT security — just a convention.

print("=== Access Convention ===")
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

# === Name mangling explained ===
print("\n=== Name Mangling ===")
print(f"dir(acc) with __: {[a for a in dir(acc) if 'pin' in a.lower()]}")
# Shows _BankAccount__pin — Python renamed it

# === Comparison with C# ===
print("\n=== Python vs C# Access Control ===")
comparison = """
Python              C#                  Meaning
name                public              accessible everywhere
_name               protected           accessible in class + subclasses (convention in Python)
__name              private             accessible only in defining class (enforced in C#)
(no equivalent)     internal            accessible within same assembly/project
(no equivalent)     protected internal  protected OR internal
(no equivalent)     private protected   protected AND internal
"""
print(comparison)
print("Python: conventions only — nothing is truly private")
print("C#:     compiler-enforced — private means private")
```

    === Access Convention ===
    owner:    Alice
    _balance: 1000
    __pin:    1234
    
    === Name Mangling ===
    dir(acc) with __: ['_BankAccount__pin', '_BankAccount__validate_pin']
    
    === Python vs C# Access Control ===
    
    Python              C#                  Meaning
    name                public              accessible everywhere
    _name               protected           accessible in class + subclasses (convention in Python)
    __name              private             accessible only in defining class (enforced in C#)
    (no equivalent)     internal            accessible within same assembly/project
    (no equivalent)     protected internal  protected OR internal
    (no equivalent)     private protected   protected AND internal
    
    Python: conventions only — nothing is truly private
    C#:     compiler-enforced — private means private
    

## 5. Static & Class Methods


```python
# Static & Class Methods
#
# KEY CONCEPTS:
# - Instance method: takes self, operates on a specific object. The default.
# - @classmethod: takes cls (the class itself) as first argument, not an instance.
#   Used for factory methods (alternative constructors) — creating objects in different ways.
#   C# equivalent: static method that returns new instance.
# - @staticmethod: no self, no cls — just a regular function inside the class namespace.
#   Doesn't access instance or class state. Used for utility functions grouped with a class.
#   C# equivalent: static method.
# - Class attributes: variables on the class itself (shared by all instances).
#   C# equivalent: static fields/properties.

print("=== Instance vs Class vs Static ===")
class Employee:
    # Class attribute — shared by ALL instances (like C# static field)
    company = "Acme Corp"
    _employee_count = 0

    def __init__(self, name, salary):
        self.name = name                 # instance attribute
        self.salary = salary
        Employee._employee_count += 1

    # Instance method — operates on self (the specific employee)
    def give_raise(self, percent):
        self.salary *= (1 + percent / 100)
        return self.salary

    # @classmethod — receives the CLASS, not an instance
    # Used as factory/alternative constructor
    @classmethod
    def from_string(cls, data_string):
        """Create Employee from 'name,salary' string."""
        name, salary = data_string.split(",")
        return cls(name, float(salary))    # cls() = Employee() (works with subclasses too)

    @classmethod
    def get_count(cls):
        return cls._employee_count

    # @staticmethod — no self, no cls. Just a utility function in the class namespace
    @staticmethod
    def is_valid_salary(salary):
        """Validate salary without needing an instance."""
        return salary > 0

    def __str__(self):
        return f"{self.name} @ {self.company}: ${self.salary:,.0f}"

# Instance method — needs an object
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

# === Why @classmethod instead of @staticmethod for factory? ===
print("\n=== classmethod works with inheritance ===")
class Manager(Employee):
    pass

# cls is Manager, not Employee — creates a Manager object!
mgr = Manager.from_string("Charlie,120000")
print(f"Type: {type(mgr).__name__}")       # Manager, not Employee
# If from_string used @staticmethod with Employee(), it would always create Employee
```

    === Instance vs Class vs Static ===
    Instance: Alice @ Acme Corp: $104,500
    Factory:  Bob @ Acme Corp: $85,000
    Static:   valid salary? True
    Static:   valid salary? False
    Count:    2 employees
    Company:  Acme Corp
    
    === classmethod works with inheritance ===
    Type: Manager
    

## 6. Dataclasses & Records


```python
# WHY Dataclasses/Records Instead of Dicts?
#
# In data pipelines, all data ends up serialized (JSON, Parquet, CSV) and stored
# in databases. So why bother with classes for moving data around?
#
# SHORT ANSWER: dataclasses aren't for the DATA itself (that flows through
# pandas/Spark/SQL). They're for everything AROUND the data: configs, metadata,
# API responses, pipeline state, error reports, task definitions.
#
# WHEN DICTS WIN:
# - Exploratory/ad-hoc work, notebooks
# - Unknown/dynamic schemas (arbitrary JSON from external API)
# - Pandas DataFrames (already structured)
# - Quick scripts you'll run once
#
# WHEN DATACLASSES WIN:
# - Production pipelines that run unattended (typos = 3am failures)
# - Shared code between team members (self-documenting)
# - Anything that gets deployed and must not fail silently
# - APIs (input/output contracts)
# - Configs, metadata, pipeline orchestration state

# === Problem 1: Typos become production bugs ===
print("=== Problem: Typos in dicts are silent ===")
# Dict — passes silently, fails at 3am:
record = {"customer_id": 123, "amout": 99.99}     # typo: "amout" not "amount"
# total = record["amount"]                          # KeyError in production! Not caught until runtime

from dataclasses import dataclass

@dataclass
class Order:
    customer_id: int
    amount: float

# order = Order(customer_id=123, amout=99.99)      # TypeError IMMEDIATELY — caught before running
order = Order(customer_id=123, amount=99.99)
print(f"Dict typo:      silent bug (amout instead of amount)")
print(f"Dataclass typo: TypeError at creation time")

# === Problem 2: What fields does this have? ===
print("\n=== Problem: Dicts are opaque ===")
def transform_dict(record: dict) -> dict:
    # What keys does record have? Must read docs or trace the code.
    return record

def transform_typed(record: Order) -> Order:
    # IDE shows: Order has .customer_id, .amount — self-documenting
    return record

print("Dict:      no autocomplete, must memorize keys")
print("Dataclass: IDE shows all fields on '.'")

# === Problem 3: Refactoring ===
print("\n=== Problem: Renaming a field ===")
print("Dict:      search-and-replace 'customer_id' strings across all files")
print("           miss one? Runtime error in production")
print("Dataclass: rename the field → IDE highlights every broken usage")

# === Problem 4: Validation ===
print("\n=== Problem: Invalid data passes silently ===")
# Dict — no validation
bad_dict = {"customer_id": "not_a_number", "amount": "free"}  # no error!

# Dataclass — at least type hints help IDE catch it
# With Pydantic — actual runtime validation:
print("Dict:      any garbage in, no error")
print("Dataclass: type hints + IDE catch mistakes")
print("Pydantic:  runtime validation (auto-converts and rejects bad data)")

# === Recommendation by use case ===
print("\n=== Recommendation ===")
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

    === Problem: Typos in dicts are silent ===
    Dict typo:      silent bug (amout instead of amount)
    Dataclass typo: TypeError at creation time
    
    === Problem: Dicts are opaque ===
    Dict:      no autocomplete, must memorize keys
    Dataclass: IDE shows all fields on '.'
    
    === Problem: Renaming a field ===
    Dict:      search-and-replace 'customer_id' strings across all files
               miss one? Runtime error in production
    Dataclass: rename the field → IDE highlights every broken usage
    
    === Problem: Invalid data passes silently ===
    Dict:      any garbage in, no error
    Dataclass: type hints + IDE catch mistakes
    Pydantic:  runtime validation (auto-converts and rejects bad data)
    
    === Recommendation ===
    
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
    
    


```python
# Dataclasses — auto-generated boilerplate for data-holding classes
#
# KEY CONCEPTS:
# - @dataclass: decorator that auto-generates __init__, __repr__, __eq__, and more.
#   Eliminates boilerplate — you just declare fields, Python writes the methods.
#   C# equivalent: record.
# - frozen=True: makes the dataclass immutable (like C# record struct).
# - field(): customize individual fields (default factory, exclude from repr, etc.).
# - order=True: auto-generates comparison methods (<, >, <=, >=).
# - Post-init: __post_init__ runs after __init__ for computed fields.
# - In DE: dataclasses are perfect for DTOs (Data Transfer Objects),
#   configuration, API responses, and pipeline record types.

from dataclasses import dataclass, field
from typing import Optional

# === Basic dataclass ===
print("=== @dataclass (auto-generates __init__, __repr__, __eq__) ===")
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

# === With defaults and field() ===
# field() parameters — customize individual dataclass fields:
#   default:          static default value (same as = value)
#   default_factory:  callable that creates a NEW default per instance (for mutable types)
#                     field(default_factory=list)  → fresh [] each time (SAFE)
#                     tags: list = []              → shared [] across all instances (BUG!)
#   init:             True/False — include in __init__ constructor? (default: True)
#                     field(init=False) → not a parameter, set in __post_init__
#   repr:             True/False — include in __repr__ output? (default: True)
#                     field(repr=False) → hidden from print/logging
#   compare:          True/False — include in __eq__ comparison? (default: True)
#                     field(compare=False) → ignored when comparing two instances
#   hash:             True/False/None — include in __hash__? (default: None = same as compare)
#   kw_only:          True/False — must be passed as keyword argument? (Python 3.10+)
#   metadata:         dict of arbitrary info (for tools/frameworks, not used by dataclass itself)
#
# When to use field():
#   Simple value:     name: str = "default"              → no field() needed
#   Mutable default:  tags: list = field(default_factory=list)  → MUST use field()
#   Exclude from init: _id: int = field(init=False)       → computed, not a parameter
#   Hide from repr:   _cache: dict = field(repr=False, default_factory=dict)
# use field() only when you need to customize behavior
print("\n=== Defaults & field() ===")
@dataclass
class Employee:
    name: str                                      # no default -> required for init
    department: str                                # no default -> required for init                     
    salary: float = 50000.0                        # default value -> optional during init
    tags: list[str] = field(default_factory=list)  # mutable default (safe!) - not required during init
    _id: int = field(init=False, repr=False)       # excluded from __init__ and __repr__

    def __post_init__(self):               # runs after __init__
        self._id = hash(self.name)                 # computed field

emp = Employee("Alice", "Engineering", 95000, ["senior", "lead"])
print(f"Employee: {emp}")
print(f"Hidden _id: {emp._id}")

# === Frozen (immutable) ===
print("\n=== frozen=True (immutable, like C# record) ===")
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

# === Order (comparison operators) ===
print("\n=== order=True (auto <, >, <=, >=) ===")
@dataclass(order=True)
# field order in the class IS the sort priority
class Version:
    major: int
    minor: int
    patch: int

versions = [Version(2, 0, 0), Version(1, 9, 5), Version(2, 1, 0)]
print(f"Sorted: {sorted(versions)}")
print(f"Max:    {max(versions)}")

# === Practical DE example ===
print("\n=== DE Use Case: Pipeline Record ===")
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

# === Comparison: regular class vs dataclass ===
print("\n=== Without @dataclass (boilerplate) ===")
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

    === @dataclass (auto-generates __init__, __repr__, __eq__) ===
    p1:        Point(x=3.0, y=4.0)
    p1 == p2:  True
    p1 == p3:  False
    
    === Defaults & field() ===
    Employee: Employee(name='Alice', department='Engineering', salary=95000, tags=['senior', 'lead'])
    Hidden _id: -595114881553153970
    
    === frozen=True (immutable, like C# record) ===
    Config: Config(host='localhost', port=5432, ssl=True)
    As dict key: {Config(host='localhost', port=5432, ssl=True): 'primary'}
    
    === order=True (auto <, >, <=, >=) ===
    Sorted: [Version(major=1, minor=9, patch=5), Version(major=2, minor=0, patch=0), Version(major=2, minor=1, patch=0)]
    Max:    Version(major=2, minor=1, patch=0)
    
    === DE Use Case: Pipeline Record ===
      users: success (ok=True)
      orders: failed (ok=False)
      products: pending (ok=False)
    
    === Without @dataclass (boilerplate) ===
    
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
    
