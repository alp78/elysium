---
title: "06 - Object-Oriented Programming - C#"
tags:
  - csharp
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
description: "C# OOP reference with executable examples and cell outputs — covers classes, interfaces, inheritance, polymorphism, properties, records, and encapsulation. See [06-py-oop](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/06-py-oop) for the Python equivalent."
parent: "[[domain-language-foundations]]"
links:
  - "[[06-py-oop]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - C#

> [!quote]
> "I made up the term 'object-oriented', and I can tell you I did not have C++ in mind."
>
> — **Alan Kay**, email to Stefan Ram (2003)
>
> "You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."
>
> — **Joe Armstrong**, *Coders at Work* interview (2009)

C# OOP organises code into classes, interfaces, inheritance hierarchies, and records. This page covers all core constructs with executable examples — from basic class declaration through to records and static members. Every concept is paired with its Python equivalent in [[06-py-oop]].

### Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| **class** | A reference type that bundles state (properties/fields) and behavior (methods) into a reusable type. | The primary unit of OOP in C# — defines what objects look like and what they can do. | Confusing the class (the blueprint) with an instance (a concrete object created with `new`). |
| **auto-property** | Shorthand `{ get; set; }` that generates a hidden backing field automatically. | Eliminates boilerplate while preserving encapsulation. | Using public fields instead of auto-properties — loses validation and encapsulation. |
| **constructor** | A special method called when `new` creates an instance. Initializes required state. | Enforces that every instance starts with valid data. | Doing heavy work (I/O, network) in a constructor — use a factory method instead. |
| **`ToString()`** | Override of `object.ToString()` to return a meaningful string representation. | Logging, debugging, and display. | Not overriding it — defaults to the type name, which isn't useful. |
| **inheritance** | A derived class acquires all fields, properties, and methods from a base class and can extend or override them. | Code reuse and specialization — `Dog : Animal` inherits `Speak()` and adds `Fetch()`. | C# supports single class inheritance only. For multiple capabilities, use interfaces. |
| **`virtual`** | Modifier that marks a method as overridable by derived classes. | Enables polymorphic dispatch — the runtime calls the most-derived version. | Forgetting `virtual` — the method cannot be overridden; derived classes get the base version. |
| **`override`** | Modifier in a derived class that replaces a `virtual` method with a new implementation. | Customize behavior for specific subtypes. | Using `new` instead of `override` — silently hides the base method, breaking polymorphism. |
| **`sealed`** | Modifier that prevents further overriding of a method or inheriting from a class. | Lock down a method or type once the correct behavior is established. | Sealing too aggressively — prevents legitimate extension. Seal only when correctness depends on it. |
| **`abstract` class** | A class that cannot be instantiated directly — `abstract` methods must be overridden by derived classes. | Define contracts with shared implementation. | Using abstract when there's no shared code — use an interface instead. |
| **interface** | A pure contract: a set of methods/properties that implementing types must provide. A class can implement multiple interfaces. | Dependency injection, testability, and multi-capability types. | Interfaces can have default implementations (C# 8+), but this is rarely used — keep them as pure contracts. |
| **polymorphism** | Code written against a base type dispatches to the correct derived implementation at runtime. | Plugin systems, strategy pattern, extensible frameworks. | Not marking the base method `virtual` — `override` without `virtual` is a compile error. |
| **`is` / `as`** | `is` tests the runtime type (and optionally binds). `as` performs a safe cast (returns `null` on failure). | Safe downcasting without exceptions. | Using a hard cast `(Dog)animal` when the type isn't guaranteed — throws `InvalidCastException`. Use `is` or `as` instead. |
| **access modifier** | Keywords (`public`, `private`, `protected`, `internal`) controlling visibility of members. | Encapsulation — expose only the intended API surface. | Defaulting everything to `public` — exposes implementation details and makes the API hard to evolve. |
| **`init`-only property** | `{ get; init; }` — can only be set during object construction (constructor or object initializer). | Immutable properties that are set once and never changed. | Trying to assign after construction — compile error. |
| **`static`** | Members belonging to the type, not any instance. One copy shared across all instances. | Shared counters, factory methods, utility functions. | Mutable static state shared across threads — race conditions without `lock` or `Interlocked`. |
| **record** | Immutable reference type with auto-generated value-based equality, `ToString`, deconstruction, and `with` expression. | DTOs, configs, API responses, pipeline metadata — the modern replacement for manually written immutable classes. | Records are reference types by default. Use `record struct` for value-type (stack-allocated) behavior. |
| **`with` expression** | Creates a modified copy of a record without mutating the original: `emp with { Salary = 110000 }`. | Non-destructive mutation for immutable data patterns. | Only works with records and record structs — not with plain classes. |
| **`record struct`** | Value-type variant of `record` — stack-allocated, no GC overhead, value-based equality. | Small, frequently created data (coordinates, versions). | Larger record structs (>16 bytes) are copied on assignment — can be slower than reference-type records. |

### What this note covers

- **Classes & Objects** — class declaration, auto-properties, constructors, `ToString`, property validation
- **Inheritance & Polymorphism** — base/derived classes, `virtual`/`override`/`sealed`, polymorphic dispatch, `is`/`as` type checking
- **Abstract Classes & Interfaces** — `abstract` classes, interfaces, default implementations, abstract vs interface decision
- **Encapsulation & Access Modifiers** — `public`/`private`/`protected`/`internal`, `init`-only properties, access modifier reference
- **Static Members** — static fields/methods/classes, factory pattern, inheritance behavior
- **Records & Init-Only Properties** — `record`, `record struct`, value equality, `with` expression, record vs dictionary decision

## Classes & Objects

Classes are C#'s fundamental building block for encapsulating state (properties/fields) and behavior (methods). Auto-properties (`{ get; set; }`) eliminate boilerplate backing fields while preserving encapsulation. Constructors enforce required initialization at creation time. For simple data carriers without behavior, prefer `record` (covered in the Records section below).

### Class declaration and usage

Defining classes with properties, constructors, methods, and `ToString` overrides, then instantiating and using them.

#### Class declaration — auto-properties, constructors, methods, ToString

Classes define types with **auto-properties** (`get`/`set`), constructors for initialization, methods for behavior, and `ToString` for display. Auto-properties eliminate boilerplate backing fields, and constructors enforce required initialization at creation. For simple data carriers without behavior, prefer `record` instead.

> [!warning] Anti-patterns
>
> - **Public fields** instead of properties — loses validation and encapsulation
> - **Constructors doing heavy work** — use factory methods or init logic
> - **Not overriding `ToString`** — defaults to type name, which isn't useful

> [!success] Best Practices
>
> - Use **auto-properties** (`{ get; set; }`) to expose state with encapsulation intact
> - Keep constructors focused on initialization; delegate complex setup to factory methods
> - Always `override ToString()` to return a meaningful representation for logging and debugging

```csharp
class Dog
{
    public const string Species = "Canis familiaris";
    public string Name { get; }
    public int Age { get; set; }

    public Dog(string name, int age)
    {
        Name = name;
        Age = age;
    }

    public string Bark() => $"{Name} says Woof!";
    public bool IsOlderThan(Dog other) => Age > other.Age;
    public override string ToString() => $"Dog({Name}, age={Age})";
}

class Circle
{
    private double _radius;

    public Circle(double radius)
    {
        Radius = radius;
    }

    public double Radius
    {
        get => _radius;
        set
        {
            if (value < 0) throw new ArgumentException("Radius can't be negative");
            _radius = value;
        }
    }

    public double Area => Math.PI * _radius * _radius;
}
```

#### Using class instances — new, property access, method calls

Creates two `Dog` instances and exercises property access, instance method calls, the static `Species` constant, and a cross-instance comparison.

```csharp
var dog1 = new Dog("Rex", 5);
var dog2 = new Dog("Buddy", 3);

Console.WriteLine(dog1);
Console.WriteLine(dog1.Name);
Console.WriteLine(dog1.Bark());
Console.WriteLine(Dog.Species);
Console.WriteLine(dog1.IsOlderThan(dog2));
```

> [!info] No Dynamic Attributes
> Unlike Python, C# only allows attributes declared in the class. Use `Dictionary<string, object>` for dynamic key-value storage.

```text
Dog(Rex, age=5)
Rex
Rex says Woof!
Canis familiaris
True
```

#### Using Circle — property with validation

The `Circle` class uses a property with a validation setter — assigning a negative radius throws `ArgumentException`. The computed property `Area` recalculates from the current radius on every access.

```csharp
var c = new Circle(5);
Console.WriteLine(c.Radius);
Console.WriteLine(c.Area);
c.Radius = 10;
Console.WriteLine(c.Radius);
```

> [!info] Property Validation
> Setters throw exceptions for invalid values. Read-only properties (no setter) produce compile errors on assignment.

```text
5
78.53981633974483
10
```

## Inheritance & Polymorphism

Inheritance lets a derived class acquire all fields, properties, and methods from a base class and then extend or modify them. C# supports single class inheritance only — for multiple capabilities, use interfaces. `virtual` marks a method as overridable, `override` replaces it in the child, `sealed` prevents further overriding. Polymorphism enables code written against the base type to work correctly with any derived type at runtime.

### Inheritance fundamentals

Defining base classes, derived classes, and using `virtual`/`override` for polymorphic dispatch.

#### Inheritance — base class, virtual, override, sealed

Inheritance lets a class (child/derived) acquire all the fields, properties, and methods of another class (parent/base) and then extend or modify them. The child class is a specialized version of the parent: a `SavingsAccount` inherits everything from `BankAccount` and adds interest calculation. In C#, `virtual` marks a method as overridable, `override` replaces it in the child, and `sealed` prevents further overriding.

> [!warning] Inheritance vs composition
> Deep inheritance hierarchies (4+ levels) become brittle — a change to the base class ripples unpredictably through all descendants. Prefer composition ("has-a") over inheritance ("is-a") when the relationship isn't genuinely hierarchical. A `Pipeline` doesn't inherit from `Logger`; it HAS a logger.

> [!success] Prefer Shallow Hierarchies and Composition
> Keep inheritance to 2–3 levels maximum. For HAS-A relationships, inject dependencies as constructor parameters or properties. Compose objects from focused, single-responsibility types rather than stretching an inheritance chain.

> [!info] Inheritance mechanics
>
> - `virtual` — marks a method for overriding
> - `override` — in a child class, provides a new implementation
> - `base.Method()` — calls the parent version
> - C# supports **single inheritance** only — one base class per type
> - Use inheritance for IS-A relationships; prefer composition (fields/properties) for HAS-A

> [!warning] Anti-patterns
>
> - **Deep hierarchies** (>3 levels) — prefer composition
> - **Forgetting `virtual`** — method won't dispatch polymorphically
> - **`new` keyword hiding** instead of `override` — silently breaks polymorphism

> [!success] Best Practices
>
> - Mark overridable methods explicitly with `virtual`; use `sealed override` to stop further overriding
> - Always use `override` (not `new`) when replacing a parent method to preserve polymorphic dispatch
> - Flatten hierarchies early — restructuring deep trees after the fact is expensive

```csharp
class Animal
{
    public string Name { get; }
    public string Sound { get; }

    public Animal(string name, string sound)
    {
        Name = name;
        Sound = sound;
    }

    public virtual string Speak() => $"{Name} says {Sound}!";
    public override string ToString() => $"{GetType().Name}({Name})";
}

class Dog : Animal
{
    public string Breed { get; }

    public Dog(string name, string breed)
        : base(name, "Woof")
    {
        Breed = breed;
    }

    public string Fetch() => $"{Name} fetches the ball!";
}

class Cat : Animal
{
    public Cat(string name) : base(name, "Meow") { }

    public override string Speak() => $"{Name} says {Sound}... when it feels like it.";
}
```

#### Using inheritance — polymorphic calls and base.Method()

Creates `Dog` and `Cat` instances and calls both inherited and overridden methods, demonstrating that `cat.Speak()` returns the `Cat`-specific version while `dog.Speak()` uses the default from `Animal`.

```csharp
var dog = new Dog("Rex", "German Shepherd");
var cat = new Cat("Whiskers");

Console.WriteLine(dog.Speak());
Console.WriteLine(dog.Fetch());
Console.WriteLine(cat.Speak());
Console.WriteLine(dog.Breed);
```

```text
Rex says Woof!
Rex fetches the ball!
Whiskers says Meow... when it feels like it.
German Shepherd
```

### Polymorphism and type checking

Polymorphism enables code written against a base type to dispatch to the correct derived implementation at runtime. Type checking with `is` and `as` enables safe downcasting.

#### Polymorphism — virtual dispatch via base class reference

Polymorphism means a variable of type `Animal` can hold a `Dog`, `Cat`, or `Bird` — and calling `animal.Speak()` executes the correct version for each type at runtime. The caller doesn't need to know the concrete type. This is how plugin systems, strategy patterns, and extensible frameworks work: code against the base type, swap implementations freely.

```csharp
void AnimalRollCall(Animal[] animals)
{
    foreach (var animal in animals)
        Console.WriteLine($"  {animal}: {animal.Speak()}");
}

Animal[] animals = { new Dog("Rex", "Shepherd"), new Cat("Whiskers"), new Dog("Buddy", "Lab") };
AnimalRollCall(animals);
```

```text
  Dog(Rex): Rex says Woof!
  Cat(Whiskers): Whiskers says Meow... when it feels like it.
  Dog(Buddy): Buddy says Woof!
```

#### Type checking with is and as

`is` tests the runtime type and optionally binds the result to a typed variable in one step. `as` performs a safe cast — returns `null` if the type doesn't match instead of throwing `InvalidCastException`.

```csharp
#nullable enable
Animal a = new Dog("Rex", "Shepherd");
Console.WriteLine(a is Dog);
Console.WriteLine(a is Animal);
Console.WriteLine(a is Cat);

if (a is Dog d)
    Console.WriteLine($"It's a dog: {d.Breed}");

Dog? maybeDog = a as Dog;
Cat? maybeCat = a as Cat;
Console.WriteLine(maybeDog?.Name ?? "null");
Console.WriteLine(maybeCat?.Name ?? "null");
```

```text
True
True
False
It's a dog: Shepherd
Rex
null
```

## Abstract Classes & Interfaces

Abstract classes and interfaces both define contracts that implementing types must fulfill. Abstract classes can include shared state (fields, constructors) and concrete methods, but support only single inheritance. Interfaces define pure contracts with no state, but a class can implement multiple interfaces. Since C# 8.0, interfaces can include default method implementations.

### Abstract classes

Abstract classes cannot be instantiated — `abstract` methods must be overridden by derived classes, while concrete methods provide shared implementation.

#### Abstract class

An `abstract` class cannot be instantiated — `abstract` methods must be overridden by derived classes, while concrete methods provide shared implementation. Unlike interfaces, abstract classes can have fields, constructors, and state. Use them when derived classes share common state and behavior; for a pure contract with no shared code, use an interface instead.

> [!warning] Anti-patterns
>
> - **Abstract class with no shared code** — use an interface instead
> - **Too many abstract methods** — interface is more appropriate
> - **Deep abstract hierarchies** — prefer composition over inheritance

> [!success] Best Practices
>
> - Use an abstract class only when derived types genuinely share fields, constructors, or concrete methods
> - If the contract has no shared implementation, define an interface instead — it supports multiple implementation
> - Limit abstract hierarchies to a single level of abstraction; combine with interfaces for multi-capability types

```csharp
abstract class Shape
{
    public string Color { get; }

    protected Shape(string color = "black")
    {
        Color = color;
    }

    public abstract double Area();
    public abstract double Perimeter();

    public string Describe() =>
        $"{Color} {GetType().Name}: area={Area():F2}";
}

class Rectangle : Shape
{
    public double Width { get; }
    public double Height { get; }

    public Rectangle(double w, double h, string color = "black") : base(color)
    {
        Width = w;
        Height = h;
    }

    public override double Area() => Width * Height;
    public override double Perimeter() => 2 * (Width + Height);
}

class CircleShape : Shape
{
    public double Radius { get; }

    public CircleShape(double r, string color = "black") : base(color)
    {
        Radius = r;
    }

    public override double Area() => Math.PI * Radius * Radius;
    public override double Perimeter() => 2 * Math.PI * Radius;
}
```

### Interfaces

Interfaces define contracts that implementing types must fulfill. A class can implement multiple interfaces (unlike single class inheritance). Interfaces are the primary mechanism for dependency injection and testability.

#### Interface declaration — contract with default implementations

An interface defines a contract: a set of methods and properties that implementing classes MUST provide. Unlike inheritance (one base class only), a class can implement multiple interfaces. Since C# 8.0, interfaces can include default method implementations — providing behavior that implementers can override but don't have to. Interfaces are the primary mechanism for dependency injection and testability.

> [!tip] Interfaces enable mocking
> In unit tests, you mock interfaces, not concrete classes. If your pipeline depends on `IDatabaseConnection` (interface), tests inject a fake. If it depends on `SqlConnection` (concrete class), you need a real database to test. Design for interfaces from the start.

```csharp
interface IDrawable
{
    string Draw();
}

interface IResizable
{
    void Resize(double factor);
}

class Button : IDrawable, IResizable
{
    public string Label { get; set; }
    public double Size { get; set; }

    public Button(string label, double size) { Label = label; Size = size; }

    public string Draw() => $"Drawing button '{Label}' size={Size:F1}";
    public void Resize(double factor) => Size *= factor;
}

class TextBox : IDrawable
{
    public string Draw() => "Drawing textbox";
}
```

#### Using abstract classes — subclass instantiation and abstract call

Instantiates `Rectangle` and `CircleShape` — both concrete subclasses of `Shape` — and calls the concrete `Describe()` method, which internally dispatches to each subclass's `Area()`. A `Shape[]` array uses LINQ to sum total area across both instances.

```csharp
var rect = new Rectangle(5, 3, "red");
var circ = new CircleShape(4, "blue");

Console.WriteLine(rect.Describe());
Console.WriteLine(circ.Describe());

Shape[] shapes = { rect, circ };
double totalArea = shapes.Sum(s => s.Area());
Console.WriteLine(totalArea);
```

```text
red Rectangle: area=15.00
blue CircleShape: area=50.27
65.27
```

#### Using interfaces — is, as, pattern matching, polymorphic dispatch

Iterates a mixed `IDrawable[]` array and calls `Draw()` on each element. Uses `is IResizable` to safely downcast `btn` and resize it, then confirms that `TextBox` does not implement `IResizable`.

```csharp
var btn = new Button("OK", 1.0);
var txt = new TextBox();

IDrawable[] widgets = { btn, txt };
foreach (var w in widgets)
    Console.WriteLine($"  {w.Draw()}");

if (btn is IResizable resizable)
{
    resizable.Resize(2.0);
    Console.WriteLine($"  Resized button: {btn.Draw()}");
}
Console.WriteLine($"  TextBox is IResizable? {txt is IResizable}");
```

```text
  Drawing button 'OK' size=1.0
  Drawing textbox
  Resized button: Drawing button 'OK' size=2.0
  TextBox is IResizable? False
```

| Feature | Abstract class | Interface |
|---|---|---|
| Members | Fields, constructors, concrete methods | Method signatures only (pure contract) |
| Inheritance | Single inheritance (one parent) | Multiple implementation allowed |
| Use when | Classes share implementation (`Shape.Describe()`) | Classes share behavior contract (`IDrawable.Draw()`) |

## Encapsulation & Access Modifiers

Encapsulation hides internal data, exposing only what's necessary. Choose the most restrictive access that works:

| Modifier | Accessible from |
|---|---|
| `public` | Everywhere |
| `private` | Defining class only (default for members) |
| `protected` | Class + its subclasses |
| `internal` | Same assembly/project |
| `protected internal` | Protected OR internal |
| `private protected` | Subclass in same assembly only |

Properties with `private set` allow read from outside, write only inside. `init`-only properties (`{ get; init; }`) can only be set during construction.

> [!warning] Access modifier pitfalls
>
> - **Public fields** bypass validation and encapsulation — use properties instead
> - **Everything public** exposes implementation details and makes the API hard to evolve
> - **`protected` for non-inheritance scenarios** — use `private` instead

> [!success] Best Practices
>
> - Default to `private` for fields and `public` only for intentional API surface
> - Use `{ get; private set; }` or `{ get; init; }` to expose read access while protecting writes
> - Reserve `protected` strictly for members that derived classes legitimately need to access or override

### Access modifier reference

Reference cells that print formatted ASCII tables for access modifier scopes and the abstract class vs interface decision. Use during code review or onboarding.

#### OOP theory — access modifiers and abstract vs interface

Prints a formatted ASCII reference table summarising all six C# access modifiers — their visibility scope and recommended use — for quick consultation during code review or pairing sessions.

```csharp
Console.WriteLine(@"
  ═══ ACCESS MODIFIERS ═══

  Modifier             Visible To                              Use For
  ───────────────────── ─────────────────────────────────────── ──────────────────────────────
  public               Everyone                                API surface, DTOs, interfaces
  private              Same class only (default for members)   Implementation details, fields
  protected            Same class + derived classes            Base class internals for children
  internal             Same assembly/project                   Implementation shared within project
  protected internal   Same assembly OR derived classes        Broad internal access
  private protected    Derived classes in same assembly only   Narrow internal inheritance

  RULES OF THUMB:
  - Fields:      always private (expose via property if needed)
  - Properties:  public get, private/protected set
  - Methods:     public for API, private for implementation
  - Classes:     internal by default, public only if needed outside assembly
  - init-only:   { get; init; } — set only during construction
");
```

#### Abstract class vs interface decision guide

Abstract classes provide shared implementation plus a contract; interfaces define pure contracts. A class can implement multiple interfaces but inherit only one abstract class. Use abstract for IS-A with shared behavior (`Shape` → `Rectangle`, `Circle`); use interfaces for CAN-DO capabilities (`IDrawable`, `IDisposable`). If you need both shared code and multiple implementation, combine abstract classes with interfaces.

```csharp
Console.WriteLine(@"
  ═══ ABSTRACT CLASS vs INTERFACE ═══

  Feature                Abstract Class              Interface
  ────────────────────── ─────────────────────────── ───────────────────────────
  Can instantiate?       No                          No
  Fields/state?          Yes                         No (constants only)
  Constructor?           Yes                         No
  Concrete methods?      Yes (shared implementation) Yes (default methods, C# 8+)
  Access modifiers?      Any                         Public only (implicit)
  Multiple inheritance?  No (single base class)      Yes (implement many)
  When to use            IS-A + shared code          CAN-DO capability contract

  DECISION GUIDE:
  - Need shared fields/constructor/state?          → Abstract class
  - Need multiple capabilities on one class?       → Interfaces
  - Building a framework with extension points?    → Abstract class
  - Defining a contract for DI/testing?            → Interface
  - Both shared code AND multiple implementation?  → Abstract + interfaces
");
```

## Static Members

Static members belong to the type, not to any instance. A `static` field is shared by all instances (one copy per type). `static` methods don't need an instance — called via `ClassName.Method()`. A `static` class can only contain static members and cannot be instantiated. Unlike Python's `@classmethod`, C# static methods cannot be overridden in subclasses.

### Static fields, methods, and factory pattern

The `Employee` class demonstrates all three static member types: a shared field (`Company`), a constructor-incremented counter, and factory and validator static methods. The second H4 exercises the full static API surface.

#### Static members — shared state, factory methods, utility classes

Declares the `Employee` class with a static shared field (`Company`), a private instance counter incremented on each construction, an `Employee.FromString` factory method, and a salary validator. All static members are accessed via `ClassName.Member` syntax without needing an instance.

> [!info] Static members
>
> - `static` fields/properties — shared by all instances, one copy per type
> - `static` methods — don't need an instance (called via `ClassName.Method()`)
> - `static` constructors — run once when the type is first used
> - `static` class — can only contain static members, cannot be instantiated
> - Unlike Python's `@classmethod`, C# static methods cannot be overridden in subclasses

> [!warning] Anti-patterns
>
> - **Mutable static state** shared across threads — race conditions
> - **Static methods that should be instance methods** — testability suffers
> - **God classes** with many static methods — violates single responsibility

> [!success] Best Practices
>
> - Keep static state immutable or use thread-safe constructs (`Interlocked`, `lock`) when mutation is unavoidable
> - Use static methods only for pure utilities and factory methods that don't depend on instance state
> - Prefer small, focused static helper classes (`MathHelper`, `DateUtils`) over large utility catch-alls

```csharp
class Employee
{
    public static string Company { get; set; } = "Acme Corp";
    private static int _employeeCount = 0;

    public string Name { get; }
    public double Salary { get; private set; }

    public Employee(string name, double salary)
    {
        Name = name;
        Salary = salary;
        _employeeCount++;
    }

    public double GiveRaise(double percent)
    {
        Salary *= (1 + percent / 100);
        return Salary;
    }

    public static Employee FromString(string data)
    {
        var parts = data.Split(',');
        return new Employee(parts[0], double.Parse(parts[1]));
    }

    public static bool IsValidSalary(double salary) => salary > 0;
    public static int EmployeeCount => _employeeCount;

    public override string ToString() => $"{Name} @ {Company}: ${Salary:N0}";
}
```

#### Using static methods and properties — Counter, MathHelper, Config

Creates two `Employee` instances — one via the constructor, one via the `FromString` factory — applies a raise, then reads static members: the instance counter, salary validator, and shared company name.

```csharp
var emp1 = new Employee("Alice", 95000);
emp1.GiveRaise(10);
Console.WriteLine(emp1);

var emp2 = Employee.FromString("Bob,85000");
Console.WriteLine(emp2);

Console.WriteLine(Employee.IsValidSalary(50000));
Console.WriteLine(Employee.EmployeeCount);
Console.WriteLine(Employee.Company);
```

```text
Alice @ Acme Corp: $104,500
Bob @ Acme Corp: $85,000
True
2
Acme Corp
```

## Records & Init-Only Properties

Records are immutable reference types with auto-generated value-based equality, `ToString`, and deconstruction. They replace dictionaries and tuples as the idiomatic way to represent structured data in C#. The `with` expression creates modified copies without mutating the original. `record struct` is the value-type variant (stack-allocated, no GC overhead).

### Records vs Dictionaries

Records catch typos at compile time, enforce types, and provide IntelliSense — dictionaries accept any key (including typos) and fail only at runtime.

#### Record vs Dictionary — why records for structured data

`Dictionary<string, object>` accepts any key (including typos) and any value type — errors only appear at runtime. Records enforce property names and types at compile time, with IntelliSense autocomplete and refactoring support. Use records for any data with a known, fixed structure (API responses, configs, DTOs); dictionaries are only appropriate for truly dynamic keys determined at runtime.

```csharp
// Dictionary — typo is silent, fails at runtime:
var record = new Dictionary<string, object>
{
    ["customer_id"] = 123,
    ["amout"] = 99.99             // typo! "amout" not "amount"
};
// var total = record["amount"];  // KeyNotFoundException at RUNTIME!

Console.WriteLine("Dict typo:   silent bug → KeyNotFoundException at runtime");
Console.WriteLine("Record typo: compile error → caught before code even runs");
```

> [!tip] Records Catch Typos at Compile Time
> Named parameters like `CustomerId:` are verified against the record definition. A typo like `Amout:` instead of `Amount:` is a compile error.

```text
Dict typo:   silent bug → KeyNotFoundException at runtime
Record typo: compile error → caught before code even runs
```

#### Autocomplete and refactoring

| Feature | Dictionary | Record |
|---|---|---|
| Autocomplete | No — must memorize string keys | IDE shows all properties on `.` |
| Renaming | Search-and-replace string keys (miss one = runtime crash) | Right-click → Rename → all usages updated |

#### Type safety and equality

`Dictionary<string, object>` accepts any value regardless of type — assigning a string to a key that logically holds a number produces no compile error. Records close this gap: wrong-typed arguments are caught at compile time. The second cell shows a second weakness: dictionary `==` is reference-based, so two dictionaries with identical entries are not equal; records compare all fields by value.

```csharp
var bad = new Dictionary<string, object>
{
    ["customer_id"] = "not_a_number",
    ["amount"] = "free"
};

Console.WriteLine("Dictionary<string, object>: any garbage in, no error");
Console.WriteLine("Record:                     wrong type = compile error");
```

> [!tip] Records Enforce Types
> Passing `"not_a_number"` to an `int` parameter is a compile error. Records provide compile-time safety that dictionaries and tuples lack.

```csharp
var dict1 = new Dictionary<string, int> { ["a"] = 1 };
var dict2 = new Dictionary<string, int> { ["a"] = 1 };
Console.WriteLine($"dict1 == dict2:  {dict1 == dict2}");
Console.WriteLine("Records:         == compares VALUES (all fields checked automatically)");
```

```text
Dictionary<string, object>: any garbage in, no error
Record:                     wrong type = compile error
dict1 == dict2:  False
Records:         == compares VALUES (all fields checked automatically)
```

#### When to use what

| Use case | Recommendation |
|---|---|
| Quick prototype | Dictionary or anonymous type |
| Entity Framework / SQL results | Entity classes (ORM maps for you) |
| Data processing | LINQ on `List<T>` or arrays |
| Pipeline config | `record` |
| API request/response | `record` + `System.Text.Json` |
| Pipeline metadata / state | `record` |
| Task queue messages | `record` |
| Logging / error reports | `record` |
| Shared library / team code | `record` (self-documenting) |
| Unknown/dynamic JSON schema | `JsonDocument` or `Dictionary` |

### Record declarations and operations

Defining record types, value equality, non-destructive mutation with `with`, and deconstruction.

#### Record type declarations

Declares four record types: a positional `Point`, a `Config` with a computed `ConnectionString` property derived from its fields, a `record struct Version` (value type, stack-allocated), and a `PipelineRecord` with an `init`-only error list and a computed `IsSuccess` flag.

```csharp
record Point(double X, double Y);
record Employee(string Name, string Department, double Salary = 50000);
record Config(string Host, int Port, bool Ssl = true)
{
    public string ConnectionString => $"{(Ssl ? "https" : "http")}://{Host}:{Port}";
}
record struct Version(int Major, int Minor, int Patch);
record PipelineRecord(string TableName, int RowCount, string Status = "pending")
{
    public List<string> Errors { get; init; } = new();
    public bool IsSuccess => Status == "success" && Errors.Count == 0;
}
```

#### Record value equality — with expression, Deconstruct

Records compare by value — two records with identical field values are equal even if they're different instances. Deconstruction unpacks positional record fields into separate variables.

```csharp
var p1 = new Point(3.0, 4.0);
var p2 = new Point(3.0, 4.0);
var p3 = new Point(1.0, 2.0);

Console.WriteLine(p1);
Console.WriteLine(p1 == p2);
Console.WriteLine(p1 == p3);

var (x, y) = p1;
Console.WriteLine($"Deconstructed: x={x}, y={y}");
```

```text
Point { X = 3, Y = 4 }
True
False
Deconstructed: x=3, y=4
```

#### Non-destructive mutation — with expression

The `with` expression creates a new record with specified fields changed — the original remains unchanged. This is non-destructive mutation, essential for immutable data patterns in pipelines.

```csharp
var emp = new Employee("Alice", "Engineering", 95000);
var promoted = emp with { Salary = 110000 };
Console.WriteLine(emp);
Console.WriteLine(promoted);
Console.WriteLine(emp == promoted);

var config = new Config("localhost", 5432);
Console.WriteLine(config);
Console.WriteLine(config.ConnectionString);
```

```text
Employee { Name = Alice, Department = Engineering, Salary = 95000 }
Employee { Name = Alice, Department = Engineering, Salary = 110000 }
False
Config { Host = localhost, Port = 5432, Ssl = True, ConnectionString = https://localhost:5432 }
https://localhost:5432
```

#### Record struct and PipelineRecord

`record struct` is a value type (stack-allocated, no GC overhead) with the same value-equality semantics as `record`. Use for small, frequently created data like coordinates, versions, and lightweight pipeline metadata.

```csharp
var versions = new[] { new Version(2, 0, 0), new Version(1, 9, 5), new Version(2, 1, 0) };
Console.WriteLine(new Version(1, 0, 0) == new Version(1, 0, 0));

var records = new[]
{
    new PipelineRecord("users", 1000, "success"),
    new PipelineRecord("orders", 500, "failed") { Errors = new() { "timeout" } },
    new PipelineRecord("products", 200),
};
foreach (var r in records)
    Console.WriteLine($"  {r.TableName}: {r.Status} (ok={r.IsSuccess})");
```

```text
True
  users: success (ok=True)
  orders: failed (ok=False)
  products: pending (ok=False)
```

| Type | Mutability | Equality | Use for |
|---|---|---|---|
| `class` | Mutable | Identity-based | Most OOP scenarios |
| `record` | Immutable | Value-based | DTOs, config, events |
| `record struct` | Immutable | Value-based (value type, stack) | Same as record but no GC |
| `struct` | Mutable | Value type | Legacy — use `record struct` in new code |

## Warnings

> [!warning] Using `new` keyword hiding instead of `override`
>
> If a derived class defines a method with the same name as a base method without using `override`, C# inserts an implicit `new` keyword. The method compiles but polymorphism silently breaks — calling through a base-type reference dispatches to the base version, not the derived one.

> [!success] Correct pattern
>
> Always use `override` to replace a `virtual` method. If the compiler warns about hiding, that's a sign you forgot `virtual` on the base or `override` on the derived.

> [!warning] Forgetting to call `base()` in derived constructors
>
> If the base class has a parameterized constructor and no default constructor, the derived class must explicitly call `: base(...)`. Otherwise the compiler reports an error — or worse, if a parameterless base constructor exists, it runs silently with wrong defaults.

> [!success] Correct pattern
>
> Always chain to the base constructor: `public Dog(string name) : base(name, "Woof") { }`. This ensures parent state is initialized correctly.

> [!warning] Mutable static state shared across threads
>
> `static int _count` without synchronization causes race conditions in multi-threaded code. Two threads incrementing simultaneously can produce wrong counts.

> [!success] Correct pattern
>
> Use `Interlocked.Increment(ref _count)` for atomic updates, or `lock` for more complex critical sections. Better yet, avoid mutable static state entirely.

> [!warning] Public fields instead of properties
>
> `public string Name;` (field) bypasses encapsulation — you cannot add validation, logging, or change notification later without breaking all callers.

> [!success] Correct pattern
>
> Always use auto-properties: `public string Name { get; set; }`. Adding a setter body later is a non-breaking change.

> [!warning] `Dictionary<string, object>` for structured data
>
> Dictionaries accept any key (including typos) and any value type — errors only appear at runtime. Records catch these at compile time.

> [!success] Correct pattern
>
> Use `record` for any data with a known, fixed structure. Reserve dictionaries for truly dynamic keys determined at runtime.

## Recommendations

- **Use records for DTOs, configs, and API contracts** — auto-generated equality, `ToString`, and `with` expression eliminate boilerplate and prevent bugs.
- **Use `record struct` for small, frequently created data** — stack-allocated, no GC overhead. Ideal for coordinates, versions, and lightweight pipeline metadata.
- **Prefer interfaces over abstract classes for contracts** — interfaces support multiple implementation and are the standard for dependency injection and testability.
- **Keep inheritance to 2–3 levels max** — deep hierarchies are brittle. Use composition (inject dependencies via constructor) for HAS-A relationships.
- **Default to `private` for fields, `public` only for intentional API** — use `{ get; private set; }` or `{ get; init; }` to protect writes while exposing reads.
- **Mark overridable methods `virtual` explicitly** — without it, derived classes cannot use `override`, and polymorphism doesn't work.
- **Use `sealed` to prevent unintended extension** — seal methods or classes when correctness depends on the exact implementation.
- **Use `is` pattern matching for safe downcasting** — `if (animal is Dog dog)` combines the type check and cast in one step, avoiding `InvalidCastException`.
- **Use factory methods for complex construction** — keep constructors focused on attribute assignment; delegate parsing, validation, and I/O to `static` factory methods.
- **Use `with` expression for immutable updates** — `config with { Port = 8080 }` creates a modified copy without mutating the original, essential for thread-safe and functional patterns.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `CS0115: no suitable method found to override` | Base method not marked `virtual`, or method signature doesn't match | Add `virtual` to the base method; ensure exact signature match |
| Polymorphism broken — base version called instead of derived | Used `new` hiding instead of `override` | Change `new` to `override` and ensure the base method is `virtual` |
| `CS7036: no argument given that corresponds to required parameter` | Derived constructor doesn't call `base(...)` with required arguments | Add `: base(arg1, arg2)` to the derived constructor |
| `InvalidCastException` on downcast | Used hard cast `(Dog)animal` when the object isn't a `Dog` | Use `as` (returns `null`) or `is` pattern matching instead |
| `NullReferenceException` after `as` cast | `as` returned `null` and result wasn't checked | Check for `null` or use `is` pattern: `if (x is Dog d)` |
| Record `==` returns `False` unexpectedly | Comparing a record with a class, or comparing collections (reference equality) | Ensure both sides are the same record type; collection fields use reference equality |
| `with` expression doesn't compile | Used on a class instead of a record | Convert to `record` or implement the `with` pattern manually |
| Static state race condition | Mutable `static` field modified without synchronization | Use `Interlocked`, `lock`, or redesign to avoid mutable static state |
| `CS0122: inaccessible due to its protection level` | Trying to access `private` or `protected` member from outside | Change access modifier or expose through a public property/method |
| Abstract class can't be instantiated | Tried `new Shape()` on an abstract class | Instantiate a concrete subclass: `new Rectangle(5, 3)` |

## Cross-References

- **Python equivalent** — [[06-py-oop]] covers classes, inheritance, ABC, Protocol, `@dataclass`, `@property`, `@classmethod`/`@staticmethod`
- **Collections** — [[05-cs-collections]] covers `record` as collection record types and struct-based value types
- **Functions** — [[04-cs-functions]] covers delegates, `Func<T>`/`Action<T>`, and extension methods that complement OOP patterns
- **Error handling** — [[08-cs-errorhandling]] covers exception hierarchies and custom exception classes
- **Design patterns** — [[18-cs-designpatterns]] covers strategy, factory, and observer patterns using OOP constructs
