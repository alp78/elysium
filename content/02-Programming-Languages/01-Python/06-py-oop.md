---
title: "06 - Object-Oriented Programming - Python"
tags:
  - python
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
description: "Python OOP reference with executable examples and cell outputs — covers classes, inheritance, polymorphism, encapsulation, properties, dataclasses, and abstract base classes. See [06-cs-oop](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/06-cs-oop) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - Python

> [!quote]+
>
> "I made up the term 'object-oriented', and I can tell you I did not have C++ in mind."
>
> — **Alan Kay**, email to Stefan Ram (2003)
>
> "You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."
>
> — **Joe Armstrong**, *Coders at Work* interview (2009)

> [!abstract]- Summary
>
> **Classes & Objects**
>
> - `class` bundles state (`__init__` attributes on `self`) and behavior (instance methods) into a reusable type
> - Class attributes are shared across all instances; instance attributes are per-object — mutable class-level defaults (lists/dicts) are a common source of bugs
> - `@property` + `@name.setter` provide validated attribute access without changing caller syntax
> - Always define both `__repr__` (debug-safe) and `__str__` (human-readable); `__init__` should only assign attributes
>
> **Inheritance & Polymorphism**
>
> - `class Child(Parent)` inherits all attributes and methods; `super().__init__()` must be called first to initialize parent state
> - Python supports multiple inheritance resolved via C3 linearization (MRO); verify order with `ClassName.__mro__`
> - Polymorphism is duck-typed — no base class required; `isinstance()` and `issubclass()` check the runtime type hierarchy
> - Mixins add capabilities (fly, swim) without being standalone bases; they carry no `__init__`
>
> **Abstract Classes & Interfaces**
>
> - `class Shape(ABC)` with `@abstractmethod` enforces that subclasses implement required methods; instantiating an abstract class directly raises `TypeError`
> - `Protocol` (structural typing) matches any class with the right methods — no inheritance required; add `@runtime_checkable` to enable `isinstance()` checks
> - Use `ABC` when the base class contains shared implementation; use `Protocol` for pure contracts
>
> **Encapsulation & Access Control**
>
> - Python access control is convention-only: `name` public, `_name` protected, `__name` triggers name mangling to `_ClassName__name`
> - `__slots__` restricts dynamic attributes and reduces per-instance memory ~40%; use `@dataclass(slots=True)` in Python 3.10+
>
> **Static & Class Methods**
>
> - `@classmethod` receives `cls` — enables factory methods that create the correct subclass type; `@staticmethod` receives no implicit argument
> - `@classmethod` factories are preferred over `@staticmethod` when the method needs to construct instances in an inheritance-aware way
>
> **Dataclasses & Records**
>
> - `@dataclass` auto-generates `__init__`, `__repr__`, `__eq__` from field annotations; eliminates boilerplate
> - `field(default_factory=list)` is required for mutable defaults; `__post_init__` handles computed fields
> - `frozen=True` makes instances immutable and hashable (usable as dict keys/set members); `order=True` auto-generates comparison operators
> - `@dataclass` is Python's equivalent of C# records
>
> **Operations & Safety**
>
> - Never use mutable class attributes (lists/dicts) — define them in `__init__` as instance attributes
> - Always call `super().__init__()` in child classes; forgetting it leaves parent attributes uninitialized
> - Use `Protocol` for structural contracts; avoid `isinstance()` checks that defeat duck typing
> - Use Pydantic at system boundaries (APIs, CSV, Kafka); use `@dataclass` for internal pipeline state

> [!note]- Glossary
>
> **`class`**
>
> - A blueprint that defines the attributes and methods of the objects created from it.
> - Every object in Python is an instance of some class.
> - In practice: `Dog` is the class; `Dog("Rex", 5)` is an instance. Class-body attributes are shared, while attributes assigned on `self` are per-instance.
>
> **`__init__`**
>
> - The constructor method called automatically when a new instance is created.
> - Its job is to establish valid instance state by assigning attributes on `self`.
> - Caution: forgetting `self` shifts every positional argument and usually raises `TypeError`.
>
> **`self`**
>
> - The conventional name for the current instance passed to every instance method.
> - It gives the method access to the object's own attributes and other methods.
> - In practice: `self` is not a keyword, but ignoring the convention makes code harder to read and maintain.
>
> **`@property`**
>
> - A decorator that exposes a method as attribute-style access such as `obj.radius`.
> - It supports getter, setter, and deleter hooks without changing the calling syntax.
> - Caution: the setter must use the same property name, for example `@radius.setter`.
>
> **inheritance**
>
> - A child class acquires attributes and methods from a parent class and may extend or override them.
> - It is appropriate for genuine IS-A relationships.
> - In practice: prefer composition when the relationship is really HAS-A.
>
> **`super()`**
>
> - A built-in that delegates to the next class in the MRO rather than a hard-coded parent name.
> - It is essential in cooperative multiple-inheritance hierarchies.
> - Caution: skipping `super().__init__()` usually leaves parent state uninitialized.
>
> **MRO (Method Resolution Order)**
>
> - The order Python uses when searching base classes for methods and attributes.
> - Python computes it with C3 linearization and exposes it at `ClassName.__mro__`.
> - In practice: verify MRO explicitly before depending on multiple-inheritance dispatch.
>
> **duck typing**
>
> - Python's default polymorphism model: if an object provides the required methods, it works.
> - No shared base class is required.
> - Caution: unnecessary `isinstance()` checks introduce rigid type coupling and defeat the point.
>
> **ABC (Abstract Base Class)**
>
> - A class from `abc` that declares abstract methods with `@abstractmethod`.
> - An ABC cannot be instantiated until all abstract methods are implemented.
> - In practice: use an ABC when the base class also contributes shared concrete behavior.
>
> **`Protocol`**
>
> - A structural interface from `typing` that classes satisfy by shape rather than inheritance.
> - Type checkers treat any class with matching members as compatible.
> - Caution: add `@runtime_checkable` if you need runtime `isinstance()` checks.
>
> **mixin**
>
> - A class designed to add one narrow capability through multiple inheritance.
> - It is not meant to be a complete standalone base class.
> - Caution: mixins should usually avoid owning initialization and avoid defining `__init__`.
>
> **encapsulation**
>
> - The practice of hiding implementation details behind a controlled public interface.
> - It protects invariants and reduces coupling between callers and internals.
> - In practice: Python relies on naming conventions and properties rather than enforced access modifiers.
>
> **name mangling**
>
> - Python rewrites `__attr` as `_ClassName__attr` to avoid accidental name collisions in subclasses.
> - It is a collision-avoidance tool, not a privacy boundary.
> - Caution: overusing name mangling makes testing and subclassing harder.
>
> **`__slots__`**
>
> - A class-level declaration that removes the per-instance `__dict__` and fixes the allowed attribute set.
> - It can materially reduce memory overhead for large numbers of small objects.
> - Caution: subclasses that omit `__slots__` reintroduce `__dict__`.
>
> **`@classmethod`**
>
> - A method decorator that passes the class object as `cls`.
> - It is the correct tool for factory methods and inheritance-aware construction.
> - In practice: `cls(...)` creates the right subclass, while a hard-coded class name does not.
>
> **`@staticmethod`**
>
> - A method decorator that binds a plain function to a class namespace without `self` or `cls`.
> - It is mainly a namespacing tool.
> - In practice: if the function does not conceptually belong to the class, prefer a module-level function.
>
> **`@dataclass`**
>
> - A decorator that generates methods such as `__init__`, `__repr__`, and `__eq__` from field annotations.
> - It is well-suited to configuration, metadata, events, and other data-carrying types.
> - Caution: mutable defaults still need `field(default_factory=...)`.
>
> **`frozen=True`**
>
> - A dataclass option that prevents field reassignment after construction.
> - With the default equality settings, it also makes instances hashable.
> - In practice: use `dataclasses.replace()` for non-destructive updates.
>
> **`field()`**
>
> - A helper that customizes individual dataclass fields.
> - Common uses include `default_factory`, `init=False`, `repr=False`, and `compare=False`.
> - In practice: combine `field(init=False)` with `__post_init__` for computed values.

*Shared imports used by the runnable examples below.*
```python
import math
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable
from dataclasses import dataclass, field
```

## Classes & Objects

Classes encapsulate state and behavior in a reusable type. Instance attributes live on `self`, class attributes live on the class object, and dunder methods such as `__str__` and `__repr__` define how instances display in logs and user-facing output.

### Class definition and usage

#### Class definition — `__init__`, attributes, and string methods

This example defines a minimal class with one shared attribute, per-instance state, a behavior method, and separate human-readable versus debugging string representations.

- Keep `__init__` limited to cheap, deterministic attribute assignment.
- Use immutable class attributes or move mutable defaults into `__init__`.
- Define both `__repr__` and `__str__` when the type will appear in logs and user output.

Use this pattern when defining a class that owns state and behavior, especially when you need shared class data, per-instance fields, and explicit string representations. The example stays in a single class so attribute ownership is easy to see.

*Defines a class with shared state, instance state, and explicit string representations.*
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

`dog1.color` exists because the instance assigned it dynamically. `dog2.color` still resolves to `None` because that attribute was initialized in `__init__` but never overwritten on the second instance.

Use this example when you need to verify where Python resolves attributes on an object. Both instances share the same class attribute but diverge on instance state, which makes per-instance mutation easy to see.

*Instantiates two dogs and exercises instance attributes, methods, and dynamic attribute assignment.*
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

Assigning to `dog1.species` does not mutate the class attribute. It creates a new instance attribute that shadows `Dog.species` only on `dog1`.

Use this when debugging a value that seems to change only on one object after assignment. The class and instance share the same attribute name, so the example can show how instance assignment creates a shadow instead of mutating the class attribute.

*Shows how an instance attribute can shadow a class attribute without changing the class value.*
```python
print(Dog.species)
print(dog1.species)

dog1.species = "Modified"
print(dog1.species)
print(dog2.species)
print(Dog.species)
```

```text
Canis familiaris
Canis familiaris
Modified
Canis familiaris
Canis familiaris
```

#### `@property` — controlled access with validation

`@property` lets callers use attribute syntax while the class still runs logic such as validation or derived-value calculation.

Use this when a field should look like plain attribute access while still enforcing validation or exposing a derived value. The setter validates writes and the second property computes a read-only result.

*Defines a property with a validating setter and a computed read-only property.*
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

```text
5
78.54
10
```

## Inheritance & Polymorphism

Inheritance expresses specialization, while polymorphism allows callers to work against behavior rather than a specific concrete type. Python supports both single and multiple inheritance and resolves conflicts through the MRO.

### Inheritance fundamentals

Use inheritance only for stable IS-A relationships. When a class merely needs another object's capability, composition usually stays simpler and more testable.

- Always call `super()` consistently in cooperative hierarchies.
- Verify `ClassName.__mro__` before depending on multiple inheritance.
- Avoid deep hierarchies when a small object graph would do the job.

#### Inheritance — base class, `super().__init__`, and method override

A child class acquires all attributes and methods of a parent class and can extend or override them. `Dog` inherits `Animal` unchanged behavior plus new behavior, while `Cat` overrides `speak()` to specialize the parent implementation.

Use this pattern for a stable IS-A relationship where a child must reuse parent initialization and may override selected methods. The parent owns the common interface while each subclass specializes part of it.

*Defines a base class plus two subclasses that extend or override behavior.*
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

The subclass constructors initialize parent state through `super()`, and the overridden `Cat.speak()` method replaces the base implementation for cat instances only.

Use this when you need to confirm that subclass construction, inherited methods, and overrides all behave as expected. One subclass keeps the parent method and one replaces it, so the runtime differences stay obvious.

*Creates subclasses and demonstrates inherited methods, overridden methods, and subclass-specific behavior.*
```python
dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

print(dog.speak())
print(dog.fetch())
print(cat.speak())
print(dog.breed)
```

```text
Rex says Woof!
Rex fetches the ball!
Whiskers says Meow... when it feels like it.
German Shepherd
```

### Polymorphism and type checking

Python prefers duck typing: call the method and let dispatch happen. Reach for `isinstance()` only when the branch genuinely depends on the concrete runtime type.

#### Polymorphism — duck typing and `isinstance()`

`animal_roll_call()` accepts any object that implements `speak()`. The `isinstance()` and `issubclass()` calls at the end show the distinct runtime-type questions that Python can answer when you actually need them.

Use this when a caller should work against behavior instead of a concrete class. The collection mixes dogs and cats while the function only cares about `speak()`, which makes the duck-typing boundary explicit.

*Calls one function with multiple concrete types and then checks the runtime type hierarchy explicitly.*
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

Mixins should stay narrowly focused and avoid owning initialization. When every class in the hierarchy cooperates through `super()`, Python's C3 linearization keeps method dispatch deterministic.

Use this when a class needs multiple orthogonal capabilities without collapsing into a deep hierarchy. The host class owns initialization while the mixins contribute methods only, so the example shows capability-style multiple inheritance.

*Builds a class from multiple parents and prints the resulting method resolution order.*
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
Donald says Quack!
Donald is flying!
Donald is swimming!
['Duck', 'Animal', 'Flyable', 'Swimmable', 'object']
```

## Abstract Classes & Interfaces

Python offers two different contract mechanisms. Use an ABC when you need shared behavior plus required overrides. Use a `Protocol` when you want a pure structural contract with no inheritance coupling.

### Abstract base classes (ABC)

#### ABC declaration and shared behavior

`Shape` defines the required interface and also contributes concrete shared behavior through `describe()`. That shared method is the main reason to choose an ABC instead of a `Protocol`.

- Keep ABCs small enough that concrete implementations stay coherent.
- Mark every required method with `@abstractmethod`.
- Prefer a `Protocol` when the contract has no shared implementation.

Use an ABC here when multiple concrete types must share both a contract and reusable base behavior. The base class owns `describe()` while subclasses implement geometry-specific calculations.

*Declares an abstract base class with shared behavior and two concrete subclasses.*
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

#### Using ABC — instantiate subclasses and reuse shared behavior

Concrete subclasses can use the shared `describe()` implementation while supplying their own area and perimeter logic.

Use this when you want to verify that concrete subclasses satisfy an ABC contract and still reuse shared base behavior. Both shapes expose the same interface and can be aggregated uniformly.

*Instantiates concrete subclasses, reuses the shared ABC method, and aggregates results across a typed collection.*
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
red Rectangle: area=15.00
blue Circle: area=50.27
65.27
```

### Protocol — structural typing

Protocols express "has these members" instead of "inherits from this base class." That makes them a good fit for plugin-style boundaries, adapters, and third-party types you do not control.

#### Protocol declaration and runtime checks

`Button` and `TextBox` satisfy `Drawable` without subclassing it. Because the protocol is marked `@runtime_checkable`, `isinstance()` can also verify compatibility at runtime.

Use a `Protocol` when unrelated classes should satisfy the same contract by shape instead of inheritance. The protocol accepts any object with a compatible `draw()` method, and `@runtime_checkable` makes the runtime check explicit.

*Defines a structural interface and shows that unrelated classes can satisfy it by shape alone.*
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

The table below is one of the few cases where a compact lookup format is clearer than prose.

| Feature | ABC | Protocol |
|---|---|---|
| Inheritance | Explicit: `class Rect(Shape)` | None needed — just have the right methods |
| Methods | Concrete + abstract (partial implementation) | Pure contract (just signatures) |

## Encapsulation & Access Control

Python does not enforce access modifiers the way C# or Java do. Instead, it uses naming conventions and name mangling, with `@property` covering the cases where callers need controlled access to internal state.

### Naming conventions and name mangling

#### Encapsulation — public, `_protected`, and `__private`

Use `_name` for implementation details that callers should not touch directly. Reserve `__name` for collision prevention in inheritance hierarchies, not as a substitute for a real public API.

- `name` means public by convention.
- `_name` means internal-use-only by convention.
- `__name` becomes `_ClassName__name` and exists mainly to avoid accidental subclass overrides.

Use this when deciding how much of an object's state belongs in its public API. The example mixes public data, convention-based internals, and name-mangled storage so the access rules stay concrete.

*Demonstrates public attributes, convention-based internal state, and name mangling.*
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
Alice
1000
1234
['_BankAccount__pin', '_BankAccount__validate_pin']
```

#### Access comparison

Python and C# are not equivalent here, but the mapping below is useful when translating design intent between the languages.

| Python convention | C# modifier | Visible to |
|---|---|---|
| `name` | `public` | Everywhere |
| `_name` | `protected` | Class + subclasses (convention in Python) |
| `__name` | `private` | Same class only (name mangling in Python) |
| (no equivalent) | `internal` | Same assembly/project |
| (no equivalent) | `protected internal` | Protected OR internal |
| (no equivalent) | `private protected` | Protected AND internal |

#### __slots__ — restrict attributes and reduce memory usage

`__slots__` removes the instance `__dict__` and forbids undeclared attributes. Use it for high-volume, fixed-shape objects where overhead matters more than late-bound flexibility.

- Slotted classes reject arbitrary new attributes at runtime.
- Subclasses must also define slots if you want to preserve the memory model.
- `@dataclass(slots=True)` is the modern way to get the same benefit for data holders.

Use `__slots__` when you need large numbers of fixed-shape objects and care more about memory overhead than ad hoc attribute creation. The example fixes the schema and then shows the failure mode for adding a new attribute.

*Creates a slotted dataclass, verifies that it has no instance dictionary, and shows the failure mode for a new attribute.*
```python
@dataclass(slots=True)
class Quote:
    symbol: str
    price: float

quote = Quote("AAPL", 187.42)
print(hasattr(quote, "__dict__"))
try:
    quote.exchange = "NASDAQ"
except AttributeError as exc:
    print(type(exc).__name__)
    print(exc)
```

```text
False
AttributeError
'Quote' object has no attribute 'exchange'
```

## Static & Class Methods

The distinction is simple: instance methods use `self`, class methods use `cls`, and static methods use neither. The hard part is choosing the right one for the API surface you want.

### Method selection

#### Defining factory and utility methods

`from_string()` is a factory and therefore belongs on a `@classmethod`. `is_valid_salary()` is a pure utility scoped to the domain of `Employee`, so `@staticmethod` is acceptable.

- Use `@classmethod` when the method constructs objects or needs class-level state.
- Use `@staticmethod` only when the function belongs conceptually to the class but does not need `self` or `cls`.
- If the function does not belong to the class at all, move it to module scope.

Use this distinction when deciding whether behavior belongs on the instance, the class, or neither. One method builds objects from strings while another validates salary values, so the example separates `@classmethod` from `@staticmethod`.

*Declares a class with both class-level factories and static utility methods.*
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

#### Using `@staticmethod` and `@classmethod`

The constructor and the factory both create `Employee` instances, but the factory turns parsing logic into a named operation instead of pushing it into `__init__`.

Use this when you need to confirm that constructors, factories, validators, and class-level counters all behave as expected together. The example creates objects through two paths and then reads shared class state.

*Creates employees through both constructors and class factories, then reads class-level state and validation helpers.*
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
Count:    2 employees
Acme Corp
```

#### `@classmethod` inheritance — `cls` is the subclass

This is the main factory advantage of `@classmethod`: subclasses inherit the factory and still receive the correct concrete type.

Use this when a factory must stay inheritance-aware. The subclass does not override the inherited classmethod, so the example can show why `cls(...)` preserves subclass identity.

*Calls an inherited classmethod from a subclass to show that the factory returns the subclass type.*
```python
class Manager(Employee):
    pass

mgr = Manager.from_string("Charlie,120000")
print(type(mgr).__name__)
```

```text
Manager
```

## Dataclasses & Records

Dataclasses are Python's standard tool for data-holding types with explicit fields, generated boilerplate, and good editor support. They are a better default than bare dictionaries when the data shape is known and important to the rest of the codebase.

### Dataclasses vs Dicts

#### When dicts are sufficient

Use a plain `dict` when the schema is ad hoc, exploratory, or inherently dynamic.

- Quick scripts and short-lived notebooks.
- Raw JSON from external systems when the schema is not stable yet.
- Data already modeled by DataFrames, SQL rows, or other structured containers.
- Throwaway glue code where the object shape is not part of the program's public design.

#### When dataclasses are the better fit

Use `@dataclass` when the field set is known and callers benefit from a named type.

- Pipeline configuration and orchestration state.
- Task definitions, metadata, events, and error reports.
- Shared library APIs where teammates need discoverable fields and safer refactors.
- Internal representations that should be explicit, searchable, and editor-friendly.

#### Dict vs `@dataclass` — typo handling

A dictionary accepts a misspelled key immediately. A dataclass constructor rejects an unexpected field name at the point of construction.

Use this comparison when a misspelled field name must fail early instead of surfacing later in production. The same payload is represented once as a dict and once as a dataclass so the difference is immediate.

*Demonstrates that a dict silently accepts a typo while a dataclass constructor rejects the wrong field name.*
```python
record = {"customer_id": 123, "amout": 99.99}

@dataclass
class Order:
    customer_id: int
    amount: float

print("amount" in record)
try:
    record["amount"]
except KeyError as exc:
    print(type(exc).__name__)
    print(exc)

try:
    Order(customer_id=123, amout=99.99)  # type: ignore[call-arg]
except TypeError as exc:
    print(type(exc).__name__)
    print(exc)
```

```text
False
KeyError
'amount'
TypeError
Order.__init__() got an unexpected keyword argument 'amout'
```

#### Autocomplete, refactoring, and type safety

The advantage of a dataclass is not runtime magic; it is that the program now has an explicit type. Editors can autocomplete fields, type checkers can reason about signatures, and refactoring tools can track renames across the codebase.

- `dict` parameters force readers to learn field names from external docs or surrounding code.
- Typed parameters tell the reader what fields exist before opening the implementation.
- Renaming a dataclass field produces static breakage instead of latent runtime drift.

Use this contrast when the team needs better editor support, safer renames, or clearer function signatures. The functions are intentionally trivial so the difference is entirely in the type surface.

*Contrasts an untyped dict signature with a typed dataclass signature.*
```python
def transform_dict(record: dict) -> dict:
    return record

def transform_typed(record: Order) -> Order:
    return record
```

#### Runtime type safety and boundary validation

Dataclasses do not validate field types at runtime. They make the schema explicit, but bad runtime values still enter unless a type checker or validation layer catches them. That is why Pydantic belongs at system boundaries where inputs are untrusted.

Use this when incoming data may have the right field names but the wrong runtime types. The dict and dataclass both hold obviously invalid business values, which shows why boundary validation belongs elsewhere.

*Shows that both dicts and plain dataclasses can still hold semantically invalid runtime values.*
```python
bad_dict = {"customer_id": "not_a_number", "amount": "free"}
bad_order = Order(customer_id="not_a_number", amount="free")  # type: ignore[arg-type]

print(type(bad_dict["amount"]).__name__)
print(type(bad_order.amount).__name__)
print(bad_order)
```

```text
str
str
Order(customer_id='not_a_number', amount='free')
```

#### Choosing `dict`, `@dataclass`, or Pydantic

Use the lightest tool that still protects the boundary you care about.

- Use `dict` for short-lived exploratory work and unknown schemas.
- Use DataFrames or SQL-native row objects for tabular data processing.
- Use `@dataclass` for internal state, metadata, task payloads, and shared code contracts.
- Use Pydantic for API payloads, CSV ingestion, Kafka messages, and any other untrusted external input.

### Dataclass declarations and features

The examples below focus on the mechanics that make dataclasses useful in production code: generated methods, safe mutable defaults, computed fields, immutability, ordering, and mixing generated boilerplate with custom logic.

#### `@dataclass` — auto-generated `__init__`, `__repr__`, and `__eq__`

Two dataclass instances compare by value rather than by object identity. That is the default behavior you usually want for data carriers.

Use this when a data-carrying object should compare by field values instead of object identity. Two instances contain the same coordinates and one differs, so the generated equality behavior is obvious.

*Creates two equal dataclass instances and one distinct instance to show generated value semantics.*
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

`field()` handles the cases where the generated defaults are not enough: mutable defaults, fields omitted from `__init__`, fields omitted from `repr`, and computed fields populated in `__post_init__`.

Use this when generated dataclass defaults are not expressive enough. The example combines a safe mutable default with a computed internal identifier so `field()` and `__post_init__` both have a concrete job.

*Uses `default_factory` and `__post_init__` to create safe mutable defaults and a deterministic computed field.*
```python
@dataclass
class Employee:
    name: str
    department: str
    salary: float = 50000.0
    tags: list[str] = field(default_factory=list)
    _id: int = field(init=False, repr=False)

    def __post_init__(self):
        self._id = sum(ord(ch) for ch in self.name)

emp = Employee("Alice", "Engineering", 95000, ["senior", "lead"])
print(emp)
print(emp._id)
```

```text
Employee(name='Alice', department='Engineering', salary=95000, tags=['senior', 'lead'])
478
```

#### `frozen=True` — immutable dataclass

`frozen=True` is the right choice for configuration objects and keys that must not change after construction. With the default equality settings, the instances are hashable and can be used directly in dictionaries and sets.

Use this when a value must remain immutable after construction so it can safely serve as shared configuration or a dictionary key. The example stores one configuration object in a mapping to show the operational effect.

*Defines an immutable dataclass and uses an instance as a dictionary key.*
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

#### `order=True` — comparable dataclass

`order=True` generates comparison operators from field order. Put the highest-priority sort key first.

Use this when objects need sorting and the class has a natural field order. The `Version` records sort lexicographically by declaration order, which makes the generated comparisons easy to inspect.

*Defines an ordered dataclass and sorts a list of versions using the generated comparison methods.*
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

#### Dataclass with computed properties

Dataclasses can still carry behavior. Use them for data-centric objects that also need lightweight derived values such as convenience predicates or normalized views.

Use this when a data holder also needs lightweight derived behavior. The record keeps operational fields and computes `is_success`, so the example shows that dataclasses can still own small behaviors.

*Combines generated dataclass methods with a computed property that derives operational state from the fields.*
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

#### Type comparison

This is another lookup case where a compact table is clearer than prose.

| Type | Mutability | Equality | Use for |
|---|---|---|---|
| `class` | Mutable | Identity-based (`is`) | Full OOP with custom behavior |
| `@dataclass` | Mutable | Value-based (`==`) | DTOs, config, events, pipeline state |
| `@dataclass(frozen=True)` | Immutable | Value-based + hashable | Dict keys, set members, immutable config |
| `namedtuple` | Immutable | Value-based + hashable | Lightweight records, tuple unpacking |

## Engineering Guidance

The remaining guidance collects the operational choices and failure modes that matter once the syntax is familiar.

### Failure modes to catch in review

#### Mutable class attributes

Never put mutable defaults such as `[]` or `{}` on the class body unless shared state is intentional. Each instance will otherwise mutate the same object.

#### Missing parent initialization

If a child overrides `__init__`, call `super().__init__(...)` before using parent-owned attributes. Skipping it leaves the object partially initialized.

#### Mutable dataclass defaults

`tags: list[str] = []` is invalid for a dataclass because the list would be shared across instances. Use `field(default_factory=list)` instead.

#### Overusing `isinstance()`

If the code always checks the concrete class before calling a method, the design is fighting duck typing. Reserve runtime type tests for genuine dispatch differences such as serializer selection.

#### Overusing name mangling

Use `__name` only when subclass collision avoidance matters. For normal internal state, `_name` is easier to test, mock, and extend.

### Choosing the right abstraction

#### Class vs dataclass

Use a manual class when behavior, invariants, or custom lifecycle logic dominate the design. Use a dataclass when the object's primary job is to carry named fields with light supporting behavior.

#### Frozen dataclass for immutable data

Choose `frozen=True` for configuration, cache keys, and values that should be safe to share across threads or call paths without defensive copying.

#### Protocol vs ABC

Choose an ABC when the base type contributes shared code. Choose a `Protocol` when you only need a contract and want to avoid inheritance coupling.

#### Inheritance depth

Keep inheritance shallow. Past two or three levels, most designs are easier to reason about as composition plus small helper objects or mixins.

#### Factory methods

Use `@classmethod` for alternate constructors because `cls(...)` preserves subclass identity. A `@staticmethod` cannot do that.

#### Slotted data classes

Use `@dataclass(slots=True)` for large populations of fixed-shape records when attribute flexibility is not required. It reduces per-instance overhead and blocks accidental new attributes.

#### Boundary validation

Use Pydantic or another runtime validator when data crosses a trust boundary. Dataclasses and type hints describe the shape, but they do not validate input at runtime by themselves.

#### `__repr__` and `__str__`

Define `__repr__` for debugging and `__str__` for user-facing output when the defaults are not sufficient. A useful `__repr__` reduces debugging time immediately.

### Diagnosing common failures

#### Constructor signature errors

`TypeError: __init__() takes N positional arguments but M were given` usually means the call site passed the wrong arity or the method forgot `self` in its signature.

#### Missing attributes after construction

`AttributeError: 'X' object has no attribute 'y'` usually means `self.y` was never assigned or a parent `__init__` was skipped.

#### Shared mutable state

If one instance mutates a list or dict and every other instance sees the change, look for a mutable class attribute or a bad dataclass default.

#### Abstract contracts and Protocol checks

`TypeError: Can't instantiate abstract class X` means one or more `@abstractmethod` members are still unimplemented. If `isinstance(obj, ProtocolType)` returns `False`, verify that the protocol is marked `@runtime_checkable` and that the object really has the required members.

#### Frozen dataclasses and mutable defaults

`FrozenInstanceError` means code tried to mutate an immutable dataclass; use `dataclasses.replace()` to produce a modified copy. `ValueError: mutable default <class 'list'>` means a dataclass field needs `default_factory`.

#### Name-mangled attributes

If `__attr` seems to disappear, remember that Python rewrites it to `_ClassName__attr`. Access the mangled name only when you have to; otherwise switch the field to a single underscore.

#### Factory methods returning the wrong type

If a classmethod factory returns the base class instead of the subclass, the method probably called `ClassName(...)` instead of `cls(...)`.

#### Static methods and polymorphism

Static methods do not participate in polymorphic construction. If subclass-specific behavior matters, move the API to a `@classmethod` or instance method.

