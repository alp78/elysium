---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
keywords: [class, interface, abstract, inheritance, polymorphism, property, record, sealed, virtual, override]
description: "C# OOP reference with executable examples and cell outputs — covers classes, interfaces, inheritance, polymorphism, properties, records, and encapsulation. See [06_py_oop](https://alp78.github.io/elysium/02-Programming-Languages/Python/06_py_oop) for the Python equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - C#

> [!quote]
> "I made up the term 'object-oriented', and I can tell you I did not have C++ in mind."
> — **Alan Kay**, email to Stefan Ram (2003)
>
> "You wanted a banana but what you got was a gorilla holding the banana and the entire jungle."
> — **Joe Armstrong**, *Coders at Work* interview (2009)

## Classes & Objects

#### Class declaration — auto-properties, constructors, methods, ToString

Classes define types with **auto-properties** (`get`/`set`), constructors for initialization, methods for behavior, and `ToString` for display. Auto-properties eliminate boilerplate backing fields, and constructors enforce required initialization at creation. For simple data carriers without behavior, prefer `record` instead.

> [!warning] Anti-patterns
>
> - **Public fields** instead of properties — loses validation and encapsulation
> - **Constructors doing heavy work** — use factory methods or init logic
> - **Not overriding `ToString`** — defaults to type name, which isn't useful

```csharp
// Classes and objects — type declarations must be in their own cell in notebooks

// Dog — basic class with auto-properties, constructor, methods, and ToString
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

// Circle — property with validation prevents invalid state; computed property for Area
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

```csharp
// Using classes — instantiation, method calls, and string representation

var dog1 = new Dog("Rex", 5);
var dog2 = new Dog("Buddy", 3);

Console.WriteLine($"dog1:        {dog1}");                    // calls ToString
Console.WriteLine($"dog1.Name:   {dog1.Name}");
Console.WriteLine($"dog1.Bark(): {dog1.Bark()}");
Console.WriteLine($"Species:     {Dog.Species}");             // const accessed on class
Console.WriteLine($"Older?:      {dog1.IsOlderThan(dog2)}");

// Can't add attributes dynamically in C#:
// dog1.Color = "brown";  // Compile error! No such property
```

    dog1:        Dog(Rex, age=5)
    dog1.Name:   Rex
    dog1.Bark(): Rex says Woof!
    Species:     Canis familiaris
    Older?:      True

#### Using Circle — property with validation

```csharp
// Property validation — prevent invalid state via setter logic

var c = new Circle(5);
Console.WriteLine($"Radius: {c.Radius}");
Console.WriteLine($"Area:   {c.Area:F2}");
c.Radius = 10;                                                // calls setter
Console.WriteLine($"New radius: {c.Radius}");
// c.Radius = -1;  // ArgumentException!
// c.Area = 100;   // Compile error! No setter
```

    Radius: 5
    Area:   78.54
    New radius: 10

## Inheritance & Polymorphism

#### Inheritance — base class, virtual, override, sealed

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

```csharp
// Inheritance and polymorphism — child classes extend a parent; virtual/override enable runtime dispatch

// Animal — base class with a virtual method that subclasses can override
class Animal
{
    public string Name { get; }
    public string Sound { get; }

    public Animal(string name, string sound)
    {
        Name = name;
        Sound = sound;
    }

    // virtual — CAN be overridden by child classes
    public virtual string Speak() => $"{Name} says {Sound}!";

    public override string ToString() => $"{GetType().Name}({Name})";
}

// Dog — inherits from Animal; adds Breed and a Dog-specific method
class Dog : Animal
{
    public string Breed { get; }

    public Dog(string name, string breed)
        : base(name, "Woof")               // call parent constructor
    {
        Breed = breed;
    }

    public string Fetch() => $"{Name} fetches the ball!";
}

// Cat — overrides Speak with its own behavior
class Cat : Animal
{
    public Cat(string name) : base(name, "Meow") { }

    public override string Speak() => $"{Name} says {Sound}... when it feels like it.";
}
```

#### Using inheritance — polymorphic calls and base.Method()

```csharp
// Using inheritance — instantiate derived classes and call overridden methods

var dog = new Dog("Rex", "German Shepherd");
var cat = new Cat("Whiskers");

Console.WriteLine($"dog.Speak():  {dog.Speak()}");       // inherited from Animal
Console.WriteLine($"dog.Fetch():  {dog.Fetch()}");       // Dog-specific
Console.WriteLine($"cat.Speak():  {cat.Speak()}");       // overridden version
Console.WriteLine($"dog.Breed:    {dog.Breed}");
```

    dog.Speak():  Rex says Woof!
    dog.Fetch():  Rex fetches the ball!
    cat.Speak():  Whiskers says Meow... when it feels like it.
    dog.Breed:    German Shepherd

#### Polymorphism — virtual dispatch via base class reference

```csharp
// Polymorphism — operate on base type, dispatch to derived implementation

void AnimalRollCall(Animal[] animals)
{
    foreach (var animal in animals)
        Console.WriteLine($"  {animal}: {animal.Speak()}");   // each calls its own version
}

Animal[] animals = { new Dog("Rex", "Shepherd"), new Cat("Whiskers"), new Dog("Buddy", "Lab") };
AnimalRollCall(animals);
```

      Dog(Rex): Rex says Woof!
      Cat(Whiskers): Whiskers says Meow... when it feels like it.
      Dog(Buddy): Buddy says Woof!

#### Type checking with is and as

```csharp
#nullable enable
// Type checking — is, as, and pattern matching for safe downcasting

Animal a = new Dog("Rex", "Shepherd");
Console.WriteLine($"a is Dog:    {a is Dog}");             // True
Console.WriteLine($"a is Animal: {a is Animal}");          // True
Console.WriteLine($"a is Cat:    {a is Cat}");             // False

// 'is' with binding — test and cast in one step
if (a is Dog d)
    Console.WriteLine($"It's a dog: {d.Breed}");

// 'as' — safe cast (returns null if wrong type)
Dog? maybeDog = a as Dog;                                  // succeeds → Dog
Cat? maybeCat = a as Cat;                                  // fails → null
Console.WriteLine($"as Dog: {maybeDog?.Name ?? "null"}");
Console.WriteLine($"as Cat: {maybeCat?.Name ?? "null"}");
```

    a is Dog:    True
    a is Animal: True
    a is Cat:    False
    It's a dog: Shepherd
    as Dog: Rex
    as Cat: null

## Abstract Classes & Interfaces

#### Abstract class

An `abstract` class cannot be instantiated — `abstract` methods must be overridden by derived classes, while concrete methods provide shared implementation. Unlike interfaces, abstract classes can have fields, constructors, and state. Use them when derived classes share common state and behavior; for a pure contract with no shared code, use an interface instead.

> [!warning] Anti-patterns
>
> - **Abstract class with no shared code** — use an interface instead
> - **Too many abstract methods** — interface is more appropriate
> - **Deep abstract hierarchies** — prefer composition over inheritance

```csharp
// Abstract classes — can't be instantiated; define a contract with abstract methods and shared logic with concrete methods

// Shape — abstract base with Area/Perimeter that subclasses must implement
abstract class Shape
{
    public string Color { get; }

    protected Shape(string color = "black")  // protected: only child classes can call
    {
        Color = color;
    }

    public abstract double Area();           // no body — child MUST implement
    public abstract double Perimeter();      // no body — child MUST implement

    public string Describe() =>              // concrete — inherited as-is
        $"{Color} {GetType().Name}: area={Area():F2}";
}

// Rectangle — implements Area and Perimeter for width × height
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

// CircleShape — implements Area and Perimeter for a radius
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

#### interface declaration — contract with default implementations

```csharp
// Interface declarations — pure contract with no implementation

interface IDrawable                          // convention: prefix with I
{
    string Draw();                           // no body, no access modifier (always public)
}

interface IResizable
{
    void Resize(double factor);
}
// A class can implement MULTIPLE interfaces (unlike single class inheritance)
class Button : IDrawable, IResizable
{
    public string Label { get; set; }
    public double Size { get; set; }

    public Button(string label, double size) { Label = label; Size = size; }

    public string Draw() => $"Drawing button '{Label}' size={Size:F1}";
    public void Resize(double factor) => Size *= factor;
}

class TextBox : IDrawable                    // only IDrawable, not IResizable
{
    public string Draw() => "Drawing textbox";
}
```

#### Using abstract classes — subclass instantiation and abstract call

```csharp
// Using abstract classes — instantiate derived types, call abstract methods

var rect = new Rectangle(5, 3, "red");
var circ = new CircleShape(4, "blue");

Console.WriteLine($"rect: {rect.Describe()}");
Console.WriteLine($"circ: {circ.Describe()}");

// Polymorphism with abstract class
Shape[] shapes = { rect, circ };
double totalArea = shapes.Sum(s => s.Area());
Console.WriteLine($"Total area: {totalArea:F2}");
```

    rect: red Rectangle: area=15.00
    circ: blue CircleShape: area=50.27
    Total area: 65.27

#### Using interfaces — is, as, pattern matching, polymorphic dispatch

```csharp
// Using interfaces and polymorphism — multiple interface implementation

var btn = new Button("OK", 1.0);
var txt = new TextBox();

// Polymorphism through interface
IDrawable[] widgets = { btn, txt };
foreach (var w in widgets)
    Console.WriteLine($"  {w.Draw()}");

// Interface type check
if (btn is IResizable resizable)
{
    resizable.Resize(2.0);
    Console.WriteLine($"  Resized button: {btn.Draw()}");
}
// TextBox is NOT IResizable
Console.WriteLine($"  TextBox is IResizable? {txt is IResizable}");  // False
```

      Drawing button 'OK' size=1.0
      Drawing textbox
      Resized button: Drawing button 'OK' size=2.0
      TextBox is IResizable? False

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

#### OOP theory — access modifiers and abstract vs interface

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

#### static members — shared state, factory methods, utility classes

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

```csharp
class Employee
{
    // Static field — shared by ALL instances
    public static string Company { get; set; } = "Acme Corp";
    private static int _employeeCount = 0;
    // Instance properties
    public string Name { get; }
    public double Salary { get; private set; }

    public Employee(string name, double salary)
    {
        Name = name;
        Salary = salary;
        _employeeCount++;
    }
    // Instance method — operates on this specific employee
    public double GiveRaise(double percent)
    {
        Salary *= (1 + percent / 100);
        return Salary;
    }
    // Static factory method
    public static Employee FromString(string data)
    {
        var parts = data.Split(',');
        return new Employee(parts[0], double.Parse(parts[1]));
    }
    // Static method — no instance needed
    public static bool IsValidSalary(double salary) => salary > 0;
    // Static property
    public static int EmployeeCount => _employeeCount;

    public override string ToString() => $"{Name} @ {Company}: ${Salary:N0}";
}
```

#### Using static methods and properties — Counter, MathHelper, Config

```csharp
// Using static members — shared state and factory methods in action

var emp1 = new Employee("Alice", 95000);
emp1.GiveRaise(10);
Console.WriteLine($"Instance: {emp1}");

var emp2 = Employee.FromString("Bob,85000");     // static factory
Console.WriteLine($"Factory:  {emp2}");

Console.WriteLine($"Static:   valid? {Employee.IsValidSalary(50000)}");
Console.WriteLine($"Count:    {Employee.EmployeeCount}");
Console.WriteLine($"Company:  {Employee.Company}");  // static property on CLASS
```

    Instance: Alice @ Acme Corp: $104'500
    Factory:  Bob @ Acme Corp: $85'000
    Static:   valid? True
    Count:    2
    Company:  Acme Corp

## Records & Init-Only Properties

#### record vs Dictionary — why records for structured data

`Dictionary<string, object>` accepts any key (including typos) and any value type — errors only appear at runtime. Records enforce property names and types at compile time, with IntelliSense autocomplete and refactoring support. Use records for any data with a known, fixed structure (API responses, configs, DTOs); dictionaries are only appropriate for truly dynamic keys determined at runtime.

```csharp
// Dictionary — typo is silent, fails at runtime:
var record = new Dictionary<string, object>
{
    ["customer_id"] = 123,
    ["amout"] = 99.99             // typo! "amout" not "amount"
};
// var total = record["amount"];  // KeyNotFoundException at RUNTIME!

// Record — typo is caught at COMPILE TIME:
// record Order(int CustomerId, double Amount);
// var order = new Order(CustomerId: 123, Amout: 99.99);  // Compile error! 'Amout' doesn't exist

Console.WriteLine("Dict typo:   silent bug → KeyNotFoundException at runtime");
Console.WriteLine("Record typo: compile error → caught before code even runs");
```

    Dict typo:   silent bug → KeyNotFoundException at runtime
    Record typo: compile error → caught before code even runs

#### Autocomplete and refactoring

| Feature | Dictionary | Record |
|---|---|---|
| Autocomplete | No — must memorize string keys | IDE shows all properties on `.` |
| Renaming | Search-and-replace string keys (miss one = runtime crash) | Right-click → Rename → all usages updated |

#### Type safety and equality

```csharp
// Type safety — records enforce types, dictionaries accept anything

var bad = new Dictionary<string, object>
{
    ["customer_id"] = "not_a_number",   // object accepts anything — no error!
    ["amount"] = "free"                 // string where number expected — no error!
};

// Record — compiler enforces types:
// var order = new Order(CustomerId: "not_a_number", Amount: "free");
// Compile error! string is not int/double
Console.WriteLine("Dictionary<string, object>: any garbage in, no error");
Console.WriteLine("Record:                     wrong type = compile error");

var dict1 = new Dictionary<string, int> { ["a"] = 1 };
var dict2 = new Dictionary<string, int> { ["a"] = 1 };
Console.WriteLine($"dict1 == dict2:  {dict1 == dict2}");     // False! Reference comparison
Console.WriteLine("Records:         == compares VALUES (all fields checked automatically)");
```

    Dictionary<string, object>: any garbage in, no error
    Record:                     wrong type = compile error
    dict1 == dict2:  False
    Records:         == compares VALUES (all fields checked automatically)

#### When to use what

```csharp
// When to use what — dict vs record vs class decision guide

Console.WriteLine(@"
USE CASE                         RECOMMENDATION
──────────────────────────────── ──────────────────────────
Quick prototype                  Dictionary or anonymous type
Entity Framework / SQL results   Entity classes (ORM maps for you)
Data processing                  LINQ on List<T> or arrays
Pipeline config                  record
API request/response             record + System.Text.Json
Pipeline metadata / state        record
Task queue messages              record
Logging / error reports          record
Shared library / team code       record (self-documenting)
Unknown/dynamic JSON schema      JsonDocument or Dictionary
");
```

    
    USE CASE                         RECOMMENDATION
    ──────────────────────────────── ──────────────────────────
    Quick prototype                  Dictionary or anonymous type
    Entity Framework / SQL results   Entity classes (ORM maps for you)
    Data processing                  LINQ on List<T> or arrays
    Pipeline config                  record
    API request/response             record + System.Text.Json
    Pipeline metadata / state        record
    Task queue messages              record
    Logging / error reports          record
    Shared library / team code       record (self-documenting)
    Unknown/dynamic JSON schema      JsonDocument or Dictionary

#### Record type declarations

```csharp
// Record types — immutable data with auto-generated equality and ToString

record Point(double X, double Y);
record Employee(string Name, string Department, double Salary = 50000);
record Config(string Host, int Port, bool Ssl = true)
{
    // Computed property
    public string ConnectionString => $"{(Ssl ? "https" : "http")}://{Host}:{Port}";
}
record struct Version(int Major, int Minor, int Patch);
record PipelineRecord(string TableName, int RowCount, string Status = "pending")
{
    public List<string> Errors { get; init; } = new();
    public bool IsSuccess => Status == "success" && Errors.Count == 0;
}
```

#### record value equality, with expression, Deconstruct

```csharp
// Value equality and deconstruction — records compare by content

var p1 = new Point(3.0, 4.0);
var p2 = new Point(3.0, 4.0);
var p3 = new Point(1.0, 2.0);

Console.WriteLine($"p1:        {p1}");                     // auto ToString
Console.WriteLine($"p1 == p2:  {p1 == p2}");               // True! Value equality (not reference)
Console.WriteLine($"p1 == p3:  {p1 == p3}");               // False

// Deconstruction (auto-generated)
var (x, y) = p1;
Console.WriteLine($"Deconstructed: x={x}, y={y}");
```

    p1:        Point { X = 3, Y = 4 }
    p1 == p2:  True
    p1 == p3:  False
    Deconstructed: x=3, y=4

#### Non-destructive mutation — with expression

```csharp
// Non-destructive mutation — with expression creates modified copies

var emp = new Employee("Alice", "Engineering", 95000);
var promoted = emp with { Salary = 110000 };               // creates NEW record
Console.WriteLine($"Original:  {emp}");
Console.WriteLine($"Promoted:  {promoted}");               // different salary
Console.WriteLine($"Same?      {emp == promoted}");        // False

var config = new Config("localhost", 5432);
Console.WriteLine($"Config: {config}");
Console.WriteLine($"ConnStr: {config.ConnectionString}");
```

    Original:  Employee { Name = Alice, Department = Engineering, Salary = 95000 }
    Promoted:  Employee { Name = Alice, Department = Engineering, Salary = 110000 }
    Same?      False
    Config: Config { Host = localhost, Port = 5432, Ssl = True, ConnectionString = https://localhost:5432 }
    ConnStr: https://localhost:5432

#### Record struct and PipelineRecord

```csharp
// Record struct and domain records — value-type records for lightweight data

var versions = new[] { new Version(2, 0, 0), new Version(1, 9, 5), new Version(2, 1, 0) };
// record structs don't auto-implement IComparable, but have value equality
Console.WriteLine($"v1 == v2: {new Version(1, 0, 0) == new Version(1, 0, 0)}");  // True

var records = new[]
{
    new PipelineRecord("users", 1000, "success"),
    new PipelineRecord("orders", 500, "failed") { Errors = new() { "timeout" } },
    new PipelineRecord("products", 200),
};
foreach (var r in records)
    Console.WriteLine($"  {r.TableName}: {r.Status} (ok={r.IsSuccess})");
```

    v1 == v2: True
      users: success (ok=True)
      orders: failed (ok=False)
      products: pending (ok=False)

| Type | Mutability | Equality | Use for |
|---|---|---|---|
| `class` | Mutable | Identity-based | Most OOP scenarios |
| `record` | Immutable | Value-based | DTOs, config, events |
| `record struct` | Immutable | Value-based (value type, stack) | Same as record but no GC |
| `struct` | Mutable | Value type | Legacy — use `record struct` in new code |
