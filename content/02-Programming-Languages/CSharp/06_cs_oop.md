---
type: reference
category: programming-languages
technology: [csharp, dotnet]
tags: [csharp]
aliases: [classes, inheritance, polymorphism, interfaces, abstract classes, encapsulation, properties]
keywords: [class, interface, abstract, inheritance, polymorphism, property, record, sealed, virtual, override]
description: "C# OOP reference with executable examples and cell outputs — covers classes, interfaces, inheritance, polymorphism, properties, records, and encapsulation. See [[06_py_oop]] for the Python equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[06_py_oop]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 06. Object-Oriented Programming - C#

## Classes & Objects

#### Type declarations

```csharp
// Class declarations — auto-properties, constructors, methods, ToString
//
// Technique: Classes define types with auto-properties (get/set), constructors
//   for initialization, methods for behavior, and ToString for display.
//   In notebooks, type declarations must be in their own cell.
//
// Benefits:
//   - Auto-properties eliminate boilerplate backing fields
//   - Constructor enforces required initialization at creation
//   - ToString integrates with Console.WriteLine and $"" interpolation
//
// Anti-patterns:
//   - Public fields instead of properties — loses validation and encapsulation
//   - Constructors doing heavy work — use factory methods or init logic
//   - Not overriding ToString — defaults to type name, not useful
//
// When to use:
//   - Any domain entity or data structure with behavior
//
// When NOT to use:
//   - Simple data carriers — use record instead

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

#### Using Dog

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

#### Type declarations

```csharp
// Inheritance — base class with virtual methods, derived classes override
//
// Technique: virtual marks a method for overriding. override in child
//   provides a new implementation. base.Method() calls parent version.
//   Single inheritance only — C# classes extend one base class.
//
// Benefits:
//   - Code reuse — shared behavior in the base class
//   - Polymorphism — derived types substitutable for the base type
//   - virtual/override is explicit — no accidental method hiding
//
// Anti-patterns:
//   - Deep inheritance hierarchies (>3 levels) — prefer composition
//   - Forgetting virtual — method won't dispatch polymorphically
//   - new keyword hiding instead of override — breaks polymorphism
//
// When to use:
//   - IS-A relationships: Dog is an Animal, Circle is a Shape
//
// When NOT to use:
//   - HAS-A relationships — use composition (fields/properties)

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

#### Using inheritance

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

#### Polymorphism — AnimalRollCall

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

<h4>Type checking with <code style="font-size:0.75em">is</code> and <code style="font-size:0.75em">as</code></h4>

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

```csharp
// Abstract class — contract with optional shared implementation
//
// Technique: abstract class cannot be instantiated. abstract methods
//   must be overridden by derived classes. Concrete methods provide
//   shared implementation. Can have fields, constructors, and state.
//
// Benefits:
//   - Enforces a contract — derived classes must implement abstract methods
//   - Shared code — concrete methods avoid duplication in derived classes
//   - Constructor initializes shared state for all derived types
//
// Anti-patterns:
//   - Abstract class with no shared code — use interface instead
//   - Too many abstract methods — interface is more appropriate
//   - Deep abstract hierarchies — prefer composition over inheritance
//
// When to use:
//   - When derived classes share common state and behavior
//
// When NOT to use:
//   - Pure contract with no shared code — use interface

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

#### Interface declarations

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

#### Using abstract classes

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

#### Using interfaces and polymorphism

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

#### Summary — abstract class vs interface

```csharp
// Summary — abstract class vs interface comparison

Console.WriteLine("Abstract class:  can have fields, constructors, concrete methods");
Console.WriteLine("Interface:       only method signatures (pure contract)");
Console.WriteLine("Abstract class:  single inheritance only (one parent)");
Console.WriteLine("Interface:       multiple implementation allowed");
Console.WriteLine("Use abstract:    when classes share implementation (Shape.Describe())");
Console.WriteLine("Use interface:   when classes share behavior contract (IDrawable.Draw())");
```

    Abstract class:  can have fields, constructors, concrete methods
    Interface:       only method signatures (pure contract)
    Abstract class:  single inheritance only (one parent)
    Interface:       multiple implementation allowed
    Use abstract:    when classes share implementation (Shape.Describe())
    Use interface:   when classes share behavior contract (IDrawable.Draw())

## Encapsulation & Access Modifiers

#### Access modifiers

```csharp
// Encapsulation and access modifiers — controlling visibility
//
// Technique: public (everyone), private (class only), protected (class +
//   derived), internal (same assembly), protected internal, private protected.
//   Properties expose controlled access; fields are typically private.
//
// Benefits:
//   - Information hiding — internal details can change without breaking callers
//   - Validation in property setters — enforce invariants
//   - Minimal public surface — easier to maintain and evolve
//
// Anti-patterns:
//   - Public fields — bypasses validation and encapsulation
//   - Everything public — exposes implementation details
//   - protected for non-inheritance scenarios — use private
//
// When to use:
//   - Every class — choose the most restrictive access that works
//
// When NOT to use:
//   - N/A — access modifiers are always applicable

// Encapsulation & Access Modifiers
//
// KEY CONCEPTS:
// - Encapsulation: hiding internal data, exposing only what's necessary.
//   public:             accessible everywhere
//   private:            accessible ONLY within the defining class (default for class members)
//   protected:          accessible in the class + its subclasses
//   internal:           accessible within the same assembly/project
//   protected internal: protected OR internal
//   private protected:  protected AND internal (subclass in same assembly only)
// - Properties with private set: read from outside, write only inside the class.
// - init-only properties: can only be set during construction ({ get; init; }).;
```

#### OOP theory — access modifiers and abstract vs interface

```csharp
// Access modifier reference — visibility rules and usage guidelines
//
// Technique: Six access levels control who can see a member. Default
//   for class members is private. Default for top-level types is internal.
//   Choose the most restrictive level that works.
//
// Benefits:
//   - Minimal public surface — easier to maintain and evolve
//   - Private implementation can change without breaking callers
//
// Anti-patterns:
//   - Defaulting to public — exposes implementation details
//   - protected for non-inheritance scenarios — use private
//
// When to use:
//   - Every class — set access explicitly on every member
//
// When NOT to use:
//   - N/A — access modifiers are always applicable

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

```csharp
// Abstract class vs interface — detailed comparison and decision criteria
//
// Technique: Abstract classes provide shared implementation + contract.
//   Interfaces define pure contracts. Classes can implement multiple
//   interfaces but inherit only one abstract class.
//
// Benefits:
//   - Abstract: shared code in base, constructor, fields, state
//   - Interface: multiple implementation, loose coupling, testability
//
// Anti-patterns:
//   - Abstract with no shared code — interface is lighter
//   - Interface when shared implementation needed — code duplication
//
// When to use:
//   - Abstract: IS-A with shared behavior (Shape → Rectangle, Circle)
//   - Interface: CAN-DO capabilities (IDrawable, IClickable, IDisposable)
//
// When NOT to use:
//   - Abstract when multiple inheritance needed — C# only allows one base class

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

#### Type declarations

```csharp
// Static members — shared state and behavior on the class itself
//
// Technique: static fields/properties are shared by all instances — one
//   copy exists per type. static methods don't need an instance to call.
//   static constructors run once when the type is first used.
//
// Benefits:
//   - Shared counters, caches, configuration accessible via ClassName.Member
//   - Factory methods: Employee.FromCsv(line) creates instances
//   - No instance needed — utility methods like Math.Sqrt()
//
// Anti-patterns:
//   - Mutable static state shared across threads — race conditions
//   - Static methods that should be instance methods — testability suffers
//   - God classes with many static methods — violates single responsibility
//
// When to use:
//   - Counters, factories, utility methods, constants, caches
//
// When NOT to use:
//   - When instance-level state is needed — use regular members

// Static Members — belong to the CLASS, not to instances
//
// KEY CONCEPTS:
// - static field/property: shared by ALL instances. Only one copy exists.
// - static method: called on the class, not on an instance. No 'this'.
// - static class: a class that can ONLY contain static members. Can't be instantiated.
// - C# has no @classmethod equivalent — static methods can't be overridden in subclasses.

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

#### Using static members

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

#### Why records instead of dictionaries

```csharp
// Why records over dictionaries — compile-time safety vs runtime errors
//
// Technique: Dictionary<string, object> accepts any key (including typos)
//   and any value type — errors only appear at runtime. Records enforce
//   property names and types at compile time.
//
// Benefits:
//   - Records catch typos at compile time — "amout" is a build error
//   - IntelliSense provides autocomplete for record properties
//   - Refactoring tools rename properties across the codebase
//
// Anti-patterns:
//   - Dictionaries for known-structure data — loses compile-time safety
//   - String keys for fixed schemas — records are type-safe alternatives
//
// When to use:
//   - Any data with a known, fixed structure (API responses, configs, DTOs)
//
// When NOT to use:
//   - Truly dynamic keys determined at runtime — dictionaries are appropriate

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

```csharp
// Autocomplete and refactoring — IDE support records provide over dicts

Console.WriteLine("Dictionary:  no autocomplete — must memorize string keys");
Console.WriteLine("Record:      IDE shows all properties on '.' → full autocomplete");
Console.WriteLine("             record Order(int CustomerId, double Amount)");
Console.WriteLine("             order.█  →  CustomerId, Amount (IDE suggests)");
Console.WriteLine("Dictionary:  search-and-replace \"customer_id\" strings across all files");
Console.WriteLine("             miss one? Runtime crash");
Console.WriteLine("Record:      right-click → Rename → all usages updated automatically");
```

    Dictionary:  no autocomplete — must memorize string keys
    Record:      IDE shows all properties on '.' → full autocomplete
                 record Order(int CustomerId, double Amount)
                 order.█  →  CustomerId, Amount (IDE suggests)
    Dictionary:  search-and-replace "customer_id" strings across all files
                 miss one? Runtime crash
    Record:      right-click → Rename → all usages updated automatically

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

#### Value equality and deconstruction

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

<h4>Non-destructive mutation — <code style="font-size:0.75em">with</code> expression</h4>

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

<h4>Record struct and <code style="font-size:0.75em">PipelineRecord</code></h4>

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

#### Summary — class vs record vs struct

```csharp
// Summary — class vs record vs record struct vs struct

Console.WriteLine("class:         mutable, identity-based equality, most OOP scenarios");
Console.WriteLine("record:        immutable, value-based equality, DTOs, config, events");
Console.WriteLine("record struct: same as record but value type (stack, no GC)");
Console.WriteLine("struct:        mutable value type (use record struct instead in new code)");
```

    class:         mutable, identity-based equality, most OOP scenarios
    record:        immutable, value-based equality, DTOs, config, events
    record struct: same as record but value type (stack, no GC)
    struct:        mutable value type (use record struct instead in new code)
