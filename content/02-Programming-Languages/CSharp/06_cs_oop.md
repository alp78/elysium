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
// Using Dog — create instances, call methods, check ToString
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
// Using Circle — property validation prevents invalid state
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
// Using inheritance — Dog and Cat extend Animal with their own Speak
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
// Polymorphism — pass an array of Animal; each calls its own overridden Speak
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
// Type checking — is tests type; as casts safely (returns null on failure)
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

    
    (12,4): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    (13,4): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.

## Abstract Classes & Interfaces

#### Abstract class

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

#### Interface declarations

```csharp
// Interface declarations — a pure contract with no implementation
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
// var shape = new Shape();  // Compile error! Can't instantiate abstract class
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
// Using interfaces — Button implements both IClickable and IDrawable
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

```csharp
// Summary — abstract class vs interface
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
// - init-only properties: can only be set during construction ({ get; init; }).

Console.WriteLine(@"
Modifier            | Same Class | Subclass | Same Assembly | Everywhere
--------------------+------------+----------+---------------+-----------
public              |     ✓      |    ✓     |      ✓        |     ✓
private (default)   |     ✓      |    ✗     |      ✗        |     ✗
protected           |     ✓      |    ✓     |      ✗        |     ✗
internal            |     ✓      |    ✗     |      ✓        |     ✗
protected internal  |     ✓      |    ✓     |      ✓        |     ✗
private protected   |     ✓      |  ✓*      |      ✗        |     ✗
                                   * only in same assembly
");
```

    
    Modifier            | Same Class | Subclass | Same Assembly | Everywhere
    --------------------+------------+----------+---------------+-----------
    public              |     ✓      |    ✓     |      ✓        |     ✓
    private (default)   |     ✓      |    ✗     |      ✗        |     ✗
    protected           |     ✓      |    ✓     |      ✗        |     ✗
    internal            |     ✓      |    ✗     |      ✓        |     ✗
    protected internal  |     ✓      |    ✓     |      ✓        |     ✗
    private protected   |     ✓      |  ✓*      |      ✗        |     ✗
                                       * only in same assembly

#### Encapsulation example and property patterns

```csharp
// Encapsulation example — access modifiers control what callers can see and modify
Console.WriteLine(@"
class BankAccount
{
    public string Owner { get; }                    // anyone can read
    public decimal Balance { get; private set; }    // read outside, write only inside
    private int _pin;                               // only this class can access

    public void Deposit(decimal amount)             // public method — the controlled API
    {
        if (amount > 0)
            Balance += amount;                      // private set allows internal write
    }

    private bool ValidatePin(int pin)               // private — internal logic only
    {
        return pin == _pin;
    }
}
");
Console.WriteLine("{ get; set; }          — read/write from anywhere");
Console.WriteLine("{ get; private set; }  — read anywhere, write only inside class");
Console.WriteLine("{ get; protected set; }— read anywhere, write in class + subclasses");
Console.WriteLine("{ get; init; }         — read anywhere, set ONLY during construction");
Console.WriteLine("{ get; }               — read-only, set only in constructor");
Console.WriteLine("C#: private is enforced — compiler rejects external access");
```

    
    class BankAccount
    {
        public string Owner { get; }                    // anyone can read
        public decimal Balance { get; private set; }    // read outside, write only inside
        private int _pin;                               // only this class can access
    
        public void Deposit(decimal amount)             // public method — the controlled API
        {
            if (amount > 0)
                Balance += amount;                      // private set allows internal write
        }
    
        private bool ValidatePin(int pin)               // private — internal logic only
        {
            return pin == _pin;
        }
    }
    
    { get; set; }          — read/write from anywhere
    { get; private set; }  — read anywhere, write only inside class
    { get; protected set; }— read anywhere, write in class + subclasses
    { get; init; }         — read anywhere, set ONLY during construction
    { get; }               — read-only, set only in constructor
    C#: private is enforced — compiler rejects external access

#### OOP theory — access modifiers and abstract vs interface

```csharp
// ============================================================
// ACCESS MODIFIERS — who can see what
// ============================================================
//
// Think of it like a building:
//   public    = front door (anyone can enter)
//   private   = locked room (only people inside this room)
//   protected = family-only room (this room + children's rooms)
//   internal  = building-only (anyone in this building/project, not outsiders)
//
// Modifier            | Same Class | Subclass | Same Project | Other Projects
// --------------------+------------+----------+--------------+----------------
// public              |     ✓      |    ✓     |      ✓       |      ✓
// private             |     ✓      |    ✗     |      ✗       |      ✗
// protected           |     ✓      |    ✓     |      ✗       |      ✗
// internal            |     ✓      |    ✗     |      ✓       |      ✗
// protected internal  |     ✓      |    ✓     |      ✓       |      ✗
// private protected   |     ✓      |    ✓*    |      ✗       |      ✗
//                                   * only if subclass is in the same project
//
// DEFAULTS (what you get if you don't specify):
//   class members:  private
//   class itself:   internal
//   interface members: public (always, can't change)
//
// RULES OF THUMB:
//   - Make everything private by default. Only expose what's needed.
//   - Use public for your API surface (what callers use).
//   - Use private for implementation details (how it works internally).
//   - Use protected when subclasses need access but outsiders don't.
//   - Use internal for things shared within your project but hidden from consumers.
//
// PROPERTY PATTERNS:
//   { get; set; }           public read + write
//   { get; private set; }   public read, only class can write
//   { get; protected set; } public read, class + subclasses can write
//   { get; init; }          public read, write ONLY during construction
//   { get; }                public read, set only in constructor (truly immutable)
```

```csharp
// ============================================================
// ABSTRACT CLASS vs INTERFACE — when to use which
// ============================================================
//
// ABSTRACT CLASS = "is a" relationship + shared implementation
//   - Use when classes share COMMON CODE (not just a contract).
//   - Can have fields, constructors, concrete methods, and abstract methods.
//   - Single inheritance only — a class can have ONE abstract parent.
//   - Example: Shape → Rectangle, Circle
//     Why abstract class? Because Describe() is shared code.
//     Rectangle and Circle ARE shapes with shared behavior.
//
// INTERFACE = "can do" capability contract
//   - Use when classes share a CAPABILITY but are otherwise unrelated.
//   - Pure contract: only method signatures (no fields, no constructors).
//   - Multiple implementation — a class can implement MANY interfaces.
//   - Example: IDrawable → Button, Chart, Map
//     Why interface? Button, Chart, Map are NOT related types.
//     They just all happen to be drawable.
//
// REAL-WORLD EXAMPLES:
//
// 1. Data pipeline — ABSTRACT CLASS
//    abstract class DataSource
//    {
//        public string Name { get; }                        // shared field
//        protected abstract Task<DataFrame> ExtractAsync();  // child implements
//        public async Task RunAsync()                        // shared orchestration
//        {
//            var data = await ExtractAsync();                // child provides this
//            await Validate(data);                           // shared logic
//            await Save(data);                               // shared logic
//        }
//    }
//    class PostgresSource : DataSource { /* implements ExtractAsync */ }
//    class BigQuerySource : DataSource { /* implements ExtractAsync */ }
//    → All sources share the same Run/Validate/Save pipeline, only Extract differs.
//
// 2. Capabilities — INTERFACE
//    interface ISerializable { byte[] Serialize(); }
//    interface ILoggable     { void Log(string message); }
//    interface IRetryable    { Task RetryAsync(int attempts); }
//
//    class ApiClient : ISerializable, IRetryable { ... }
//    class FileWriter : ILoggable { ... }
//    class PipelineStep : ILoggable, IRetryable, ISerializable { ... }
//    → Unrelated classes, but each declares which capabilities it supports.
//
// 3. Mixed — ABSTRACT CLASS + INTERFACES
//    abstract class DataSource : ILoggable, IRetryable
//    {
//        public void Log(string msg) { ... }               // shared implementation
//        public abstract Task RetryAsync(int attempts);    // child decides retry strategy
//        protected abstract Task<Data> ExtractAsync();
//    }
//    → Abstract class for shared "is a" relationship, interfaces for capabilities.
//
// DECISION TREE:
//   Do the classes share actual CODE (fields, methods, constructor logic)?
//     YES → abstract class
//     NO  → interface
//   Does a class need MULTIPLE "parents"?
//     YES → interfaces (can implement many)
//     NO  → either works, prefer interface for flexibility
//   Will the contract evolve over time (add methods later)?
//     YES → abstract class (can add concrete methods without breaking children)
//     YES → interface with default methods (C# 8+, but controversial)
//     NO  → interface is fine
```

## Static Members

#### Type declarations

```csharp
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
// Using static members — shared state and factory methods
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
// Autocomplete and refactoring — records give IDE support that dicts lack
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
// Dictionary — no type checking:
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
// When to use what — dict for dynamic keys, record for known structure
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
// Records — auto-generated immutable data types (C# 9+)
//
// KEY CONCEPTS:
// - record: a reference type with auto-generated Equals, GetHashCode, ToString, and
// - Positional record: record Point(double X, double Y) — one-line declaration.
//   Auto-generates constructor, properties, Deconstruct, ToString, Equals.
// - with expression: creates a copy with some values changed (non-destructive).
// - init-only property ({ get; init; }): can only be set during construction.
// - In DE: records are perfect for DTOs, configuration, API responses, immutable state.
// - DTO (Data Transfer Object): an object that only carries data, no logic.
//   Just a container for moving data between layers (DB → API → pipeline).

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
// Value equality and deconstruction — records compare by value, not reference
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
// Non-destructive mutation — with expression creates a copy with changes
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
// Record struct and PipelineRecord — value-type records for lightweight data
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
