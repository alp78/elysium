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

## 1. Classes & Objects


```csharp
// Classes & Objects — type declarations must be in their own cell
//
// KEY CONCEPTS:
// - Class: a blueprint for creating objects. Defines fields/properties (data)
//   and methods (behavior). Like a cookie cutter.
// - Object (instance): a specific thing created with 'new ClassName()'.
// - Constructor: method with same name as class — called on 'new'. Python: __init__.
// - this: refers to the current instance. Python: self (explicit parameter).
// - Fields: variables inside a class. Typically private (backing store).
// - Properties: controlled access to fields with get/set. Python: @property.
//   Auto-properties ({ get; set; }) generate the field automatically.
// - Access modifiers: public, private, protected, internal (covered in section 4).
// - C# classes are static — ALL fields/properties must be declared at compile time.
//   Python classes are dynamic — can add attributes at runtime.
 
class Dog
{
    // Class-level constant (like Python class attribute)
    public const string Species = "Canis familiaris";

    // Auto-properties — compiler generates backing field automatically
    // { get; set; } = read and write
    // { get; } = read-only (set only in constructor)
    public string Name { get; }
    public int Age { get; set; }

    // Constructor — called when you write 'new Dog(...)'
    public Dog(string name, int age)
    {
        Name = name;           // 'this' is implicit (unlike Python's explicit 'self')
        Age = age;
    }

    // Method
    public string Bark() => $"{Name} says Woof!";

    // Method with parameter
    public bool IsOlderThan(Dog other) => Age > other.Age;

    // ToString — equivalent to Python's __str__
    public override string ToString() => $"Dog({Name}, age={Age})";
}

class Circle
{
    private double _radius;        // private backing field (convention: _prefix)

    public Circle(double radius)
    {
        Radius = radius;           // goes through the setter (validates)
    }

    // Property with validation (like Python @property + @setter)
    public double Radius
    {
        get => _radius;
        set
        {
            if (value < 0) throw new ArgumentException("Radius can't be negative");
            _radius = value;
        }
    }

    // Computed property — read-only (like Python @property without setter)
    public double Area => Math.PI * _radius * _radius;
}
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:9c70:c598:8ab4:ea30:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '3848.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>



```csharp
// Using Dog and Circle (run previous cell first)
Console.WriteLine("=== Creating Objects ===");
var dog1 = new Dog("Rex", 5);
var dog2 = new Dog("Buddy", 3);

Console.WriteLine($"dog1:        {dog1}");                    // calls ToString
Console.WriteLine($"dog1.Name:   {dog1.Name}");
Console.WriteLine($"dog1.Bark(): {dog1.Bark()}");
Console.WriteLine($"Species:     {Dog.Species}");             // const accessed on class
Console.WriteLine($"Older?:      {dog1.IsOlderThan(dog2)}");

// Can't add attributes dynamically in C#:
// dog1.Color = "brown";  // Compile error! No such property

Console.WriteLine("\n=== Properties ===");
var c = new Circle(5);
Console.WriteLine($"Radius: {c.Radius}");
Console.WriteLine($"Area:   {c.Area:F2}");
c.Radius = 10;                                                // calls setter
Console.WriteLine($"New radius: {c.Radius}");
// c.Radius = -1;  // ArgumentException!
// c.Area = 100;   // Compile error! No setter
```

    === Creating Objects ===
    dog1:        Dog(Rex, age=5)
    dog1.Name:   Rex
    dog1.Bark(): Rex says Woof!
    Species:     Canis familiaris
    Older?:      True
    
    === Properties ===
    Radius: 5
    Area:   78.54
    New radius: 10
    

## 2. Inheritance & Polymorphism


```csharp
// Inheritance & Polymorphism — type declarations
//
// KEY CONCEPTS:
// - Inheritance: class Child : Parent — child inherits all public/protected members.
// - virtual: marks a method as OVERRIDABLE. Without virtual, child can't override it.
//   Python: all methods are virtual by default. C#: must explicitly mark with virtual.
// - override: child provides its own version of a virtual method.
// - base: calls the parent's method (like Python's super()).
// - sealed: prevents a class from being inherited, or a method from being overridden further.
// - Polymorphism: treating Child objects as Parent type — the overridden method runs.
// - Single inheritance only: C# allows ONE parent class (+ multiple interfaces).
//   Python allows multiple inheritance.
// - is: type check at runtime (like Python's isinstance).
// - as: safe cast — returns null if the cast fails.

class Animal
{
    public string Name { get; }
    public string Sound { get; }

    public Animal(string name, string sound)
    {
        Name = name;
        Sound = sound;
    }

    // virtual = CAN be overridden by child classes
    public virtual string Speak() => $"{Name} says {Sound}!";

    public override string ToString() => $"{GetType().Name}({Name})";
}

class Dog : Animal                          // Dog inherits from Animal
{
    public string Breed { get; }

    public Dog(string name, string breed)
        : base(name, "Woof")               // call parent constructor (like super().__init__)
    {
        Breed = breed;
    }

    public string Fetch() => $"{Name} fetches the ball!";  // Dog-specific
}

class Cat : Animal
{
    public Cat(string name) : base(name, "Meow") { }

    // override = replace parent's Speak with our own version
    public override string Speak() => $"{Name} says {Sound}... when it feels like it.";
}
```


```csharp
// Using inheritance (run previous cell first)
Console.WriteLine("=== Inheritance ===");
var dog = new Dog("Rex", "German Shepherd");
var cat = new Cat("Whiskers");

Console.WriteLine($"dog.Speak():  {dog.Speak()}");       // inherited from Animal
Console.WriteLine($"dog.Fetch():  {dog.Fetch()}");       // Dog-specific
Console.WriteLine($"cat.Speak():  {cat.Speak()}");       // overridden version
Console.WriteLine($"dog.Breed:    {dog.Breed}");

// === Polymorphism — same interface, different behavior ===
Console.WriteLine("\n=== Polymorphism ===");
void AnimalRollCall(Animal[] animals)
{
    foreach (var animal in animals)
        Console.WriteLine($"  {animal}: {animal.Speak()}");   // each calls its own version
}

Animal[] animals = { new Dog("Rex", "Shepherd"), new Cat("Whiskers"), new Dog("Buddy", "Lab") };
AnimalRollCall(animals);

// === Type checking — is / as ===
Console.WriteLine("\n=== Type Checking ===");
Animal a = new Dog("Rex", "Shepherd");
Console.WriteLine($"a is Dog:    {a is Dog}");             // True
Console.WriteLine($"a is Animal: {a is Animal}");          // True
Console.WriteLine($"a is Cat:    {a is Cat}");             // False

// 'is' with binding (like Python isinstance + variable)
if (a is Dog d)
    Console.WriteLine($"It's a dog: {d.Breed}");

// 'as' — safe cast (returns null if wrong type)
Dog? maybeDog = a as Dog;                                  // succeeds → Dog
Cat? maybeCat = a as Cat;                                  // fails → null
Console.WriteLine($"as Dog: {maybeDog?.Name ?? "null"}");
Console.WriteLine($"as Cat: {maybeCat?.Name ?? "null"}");

// === No multiple inheritance — use interfaces instead (section 3) ===
Console.WriteLine("\n=== No Multiple Inheritance in C# ===");
Console.WriteLine("Python: class Duck(Animal, Flyable, Swimmable)  → multiple parents OK");
Console.WriteLine("C#:     class Duck : Animal, IFlyable, ISwimmable → one class + interfaces");
```

    === Inheritance ===
    dog.Speak():  Rex says Woof!
    dog.Fetch():  Rex fetches the ball!
    cat.Speak():  Whiskers says Meow... when it feels like it.
    dog.Breed:    German Shepherd
    
    === Polymorphism ===
      Dog(Rex): Rex says Woof!
      Cat(Whiskers): Whiskers says Meow... when it feels like it.
      Dog(Buddy): Buddy says Woof!
    
    === Type Checking ===
    a is Dog:    True
    a is Animal: True
    a is Cat:    False
    It's a dog: Shepherd
    as Dog: Rex
    as Cat: null
    
    === No Multiple Inheritance in C# ===
    Python: class Duck(Animal, Flyable, Swimmable)  → multiple parents OK
    C#:     class Duck : Animal, IFlyable, ISwimmable → one class + interfaces
    

    
    (34,4): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    (35,4): warning CS8632: The annotation for nullable reference types should only be used in code within a '#nullable' annotations context.
    
    

## 3. Abstract Classes & Interfaces


```csharp
// Abstract Classes & Interfaces — type declarations
//
// KEY CONCEPTS:
// - abstract class: can't be instantiated — only inherited. Can have both
//   abstract methods (no body, child MUST implement) and concrete methods (with body).
//   Python equivalent: ABC with @abstractmethod.
// - interface: a pure contract — only method signatures, no implementation.
//   A class can implement MULTIPLE interfaces (unlike classes: single inheritance only).
//   Python equivalent: Protocol (but Protocol is implicit, interface is explicit).
// - abstract method: declared with 'abstract' keyword — no body, child must override.
// - virtual method: has a body but CAN be overridden. Abstract = must, virtual = can.
// - interface naming convention: prefix with 'I' (IDrawable, IComparable, IEnumerable).

// === Abstract class ===
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

class Rectangle : Shape
{
    public double Width { get; }
    public double Height { get; }

    public Rectangle(double w, double h, string color = "black") : base(color)
    {
        Width = w;
        Height = h;
    }

    public override double Area() => Width * Height;              // MUST implement
    public override double Perimeter() => 2 * (Width + Height);   // MUST implement
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

// === Interface — pure contract ===
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


```csharp
// Using abstract classes & interfaces
Console.WriteLine("=== Abstract Class ===");
// var shape = new Shape();  // Compile error! Can't instantiate abstract class
var rect = new Rectangle(5, 3, "red");
var circ = new CircleShape(4, "blue");

Console.WriteLine($"rect: {rect.Describe()}");
Console.WriteLine($"circ: {circ.Describe()}");

// Polymorphism with abstract class
Shape[] shapes = { rect, circ };
double totalArea = shapes.Sum(s => s.Area());
Console.WriteLine($"Total area: {totalArea:F2}");

// === Interface usage ===
Console.WriteLine("\n=== Interface ===");
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

// === Abstract class vs Interface ===
Console.WriteLine("\n=== Abstract Class vs Interface ===");
Console.WriteLine("Abstract class:  can have fields, constructors, concrete methods");
Console.WriteLine("Interface:       only method signatures (pure contract)");
Console.WriteLine("Abstract class:  single inheritance only (one parent)");
Console.WriteLine("Interface:       multiple implementation allowed");
Console.WriteLine("Use abstract:    when classes share implementation (Shape.Describe())");
Console.WriteLine("Use interface:   when classes share behavior contract (IDrawable.Draw())");
```

    === Abstract Class ===
    rect: red Rectangle: area=15.00
    circ: blue CircleShape: area=50.27
    Total area: 65.27
    
    === Interface ===
      Drawing button 'OK' size=1.0
      Drawing textbox
      Resized button: Drawing button 'OK' size=2.0
      TextBox is IResizable? False
    
    === Abstract Class vs Interface ===
    Abstract class:  can have fields, constructors, concrete methods
    Interface:       only method signatures (pure contract)
    Abstract class:  single inheritance only (one parent)
    Interface:       multiple implementation allowed
    Use abstract:    when classes share implementation (Shape.Describe())
    Use interface:   when classes share behavior contract (IDrawable.Draw())
    

## 4. Encapsulation & Access Modifiers


```csharp
// Encapsulation & Access Modifiers
//
// KEY CONCEPTS:
// - Encapsulation: hiding internal data, exposing only what's necessary.
// - C# has REAL access modifiers enforced by the compiler (unlike Python's conventions):
//   public:             accessible everywhere
//   private:            accessible ONLY within the defining class (default for class members)
//   protected:          accessible in the class + its subclasses
//   internal:           accessible within the same assembly/project
//   protected internal: protected OR internal
//   private protected:  protected AND internal (subclass in same assembly only)
// - Properties with private set: read from outside, write only inside the class.
// - init-only properties: can only be set during construction ({ get; init; }).

Console.WriteLine("=== Access Modifiers ===");
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

Console.WriteLine("=== In Practice ===");
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

// === Property access levels ===
Console.WriteLine("=== Property Access Patterns ===");
Console.WriteLine("{ get; set; }          — read/write from anywhere");
Console.WriteLine("{ get; private set; }  — read anywhere, write only inside class");
Console.WriteLine("{ get; protected set; }— read anywhere, write in class + subclasses");
Console.WriteLine("{ get; init; }         — read anywhere, set ONLY during construction");
Console.WriteLine("{ get; }               — read-only, set only in constructor");

Console.WriteLine("\n=== Python vs C# ===");
Console.WriteLine("Python: _name is a convention — anyone CAN still access it");
Console.WriteLine("C#:     private is enforced — compiler rejects external access");
Console.WriteLine("Python: __name uses name mangling — still accessible via _Class__name");
Console.WriteLine("C#:     private is truly private — no workaround (except reflection)");
```

    === Access Modifiers ===
    
    Modifier            | Same Class | Subclass | Same Assembly | Everywhere
    --------------------+------------+----------+---------------+-----------
    public              |     ✓      |    ✓     |      ✓        |     ✓
    private (default)   |     ✓      |    ✗     |      ✗        |     ✗
    protected           |     ✓      |    ✓     |      ✗        |     ✗
    internal            |     ✓      |    ✗     |      ✓        |     ✗
    protected internal  |     ✓      |    ✓     |      ✓        |     ✗
    private protected   |     ✓      |  ✓*      |      ✗        |     ✗
                                       * only in same assembly
    
    === In Practice ===
    
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
    
    === Property Access Patterns ===
    { get; set; }          — read/write from anywhere
    { get; private set; }  — read anywhere, write only inside class
    { get; protected set; }— read anywhere, write in class + subclasses
    { get; init; }         — read anywhere, set ONLY during construction
    { get; }               — read-only, set only in constructor
    
    === Python vs C# ===
    Python: _name is a convention — anyone CAN still access it
    C#:     private is enforced — compiler rejects external access
    Python: __name uses name mangling — still accessible via _Class__name
    C#:     private is truly private — no workaround (except reflection)
    


```csharp
// === OOP Theory: Access Modifiers & Abstract vs Interface ===

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

## 5. Static Members


```csharp
// Static Members — belong to the CLASS, not to instances
//
// KEY CONCEPTS:
// - static field/property: shared by ALL instances. Only one copy exists.
//   Python equivalent: class attributes.
// - static method: called on the class, not on an instance. No 'this'.
//   Python equivalent: @staticmethod (utility) or @classmethod (factory).
// - static class: a class that can ONLY contain static members. Can't be instantiated.
//   Python equivalent: a module with functions (no class needed).
// - const: compile-time constant (always static). Python: UPPERCASE convention.
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

    // Static factory method (like Python @classmethod)
    public static Employee FromString(string data)
    {
        var parts = data.Split(',');
        return new Employee(parts[0], double.Parse(parts[1]));
    }

    // Static method — no instance needed (like Python @staticmethod)
    public static bool IsValidSalary(double salary) => salary > 0;

    // Static property
    public static int EmployeeCount => _employeeCount;

    public override string ToString() => $"{Name} @ {Company}: ${Salary:N0}";
}
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::280b:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:9c70:c598:8ab4:ea30:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '8976.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>



```csharp
// Using static members (run previous cell first)
Console.WriteLine("=== Static Members ===");
var emp1 = new Employee("Alice", 95000);
emp1.GiveRaise(10);
Console.WriteLine($"Instance: {emp1}");

var emp2 = Employee.FromString("Bob,85000");     // static factory
Console.WriteLine($"Factory:  {emp2}");

Console.WriteLine($"Static:   valid? {Employee.IsValidSalary(50000)}");
Console.WriteLine($"Count:    {Employee.EmployeeCount}");
Console.WriteLine($"Company:  {Employee.Company}");  // static property on CLASS

// === Key Differences ===
Console.WriteLine("\n=== Python vs C# Static ===");
Console.WriteLine("Python @staticmethod:  no self, no cls → C#: static method");
Console.WriteLine("Python @classmethod:   cls parameter   → C#: static method (but no cls)");
Console.WriteLine("Python class attribute:                → C#: static field/property");
Console.WriteLine("Python module functions:               → C#: static class with static methods");
Console.WriteLine("");
Console.WriteLine("Key difference: Python @classmethod receives cls and works with inheritance.");
Console.WriteLine("C# static methods don't — they always belong to the exact class.");
```

    === Static Members ===
    Instance: Alice @ Acme Corp: $104'500
    Factory:  Bob @ Acme Corp: $85'000
    Static:   valid? True
    Count:    8
    Company:  Acme Corp
    
    === Python vs C# Static ===
    Python @staticmethod:  no self, no cls → C#: static method
    Python @classmethod:   cls parameter   → C#: static method (but no cls)
    Python class attribute:                → C#: static field/property
    Python module functions:               → C#: static class with static methods
    
    Key difference: Python @classmethod receives cls and works with inheritance.
    C# static methods don't — they always belong to the exact class.
    

## 6. Records & Init-Only Properties


```csharp
// WHY Records Instead of Dictionaries?
//
// In data pipelines, all data ends up serialized (JSON, Parquet, CSV) and stored
// in databases. So why bother with classes for moving data around?
//
// SHORT ANSWER: records aren't for the DATA itself (that flows through
// DataFrames/SQL/Entity Framework). They're for everything AROUND the data:
// configs, metadata, API responses, pipeline state, error reports, task definitions.
//
// WHEN DICTIONARIES WIN:
// - Dynamic/unknown schemas (arbitrary JSON from external API)
// - Quick prototyping
// - Config files with arbitrary keys
//
// WHEN RECORDS WIN:
// - Production pipelines that run unattended (typos = compile errors, not 3am crashes)
// - Shared code between team members (self-documenting)
// - Anything that gets deployed and must not fail silently
// - APIs (input/output contracts)
// - Configs, metadata, pipeline orchestration state

// === Problem 1: Typos become production bugs ===
Console.WriteLine("=== Problem: Typos in dicts are silent ===");

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

// === Problem 2: What fields does this have? ===
Console.WriteLine("\n=== Problem: Dicts are opaque ===");
Console.WriteLine("Dictionary:  no autocomplete — must memorize string keys");
Console.WriteLine("Record:      IDE shows all properties on '.' → full autocomplete");
Console.WriteLine("             record Order(int CustomerId, double Amount)");
Console.WriteLine("             order.█  →  CustomerId, Amount (IDE suggests)");

// === Problem 3: Refactoring ===
Console.WriteLine("\n=== Problem: Renaming a field ===");
Console.WriteLine("Dictionary:  search-and-replace \"customer_id\" strings across all files");
Console.WriteLine("             miss one? Runtime crash");
Console.WriteLine("Record:      right-click → Rename → all usages updated automatically");

// === Problem 4: Type safety ===
Console.WriteLine("\n=== Problem: Invalid data passes silently ===");
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

// === Problem 5: Equality ===
Console.WriteLine("\n=== Problem: Comparing data ===");
var dict1 = new Dictionary<string, int> { ["a"] = 1 };
var dict2 = new Dictionary<string, int> { ["a"] = 1 };
Console.WriteLine($"dict1 == dict2:  {dict1 == dict2}");     // False! Reference comparison
Console.WriteLine("Records:         == compares VALUES (all fields checked automatically)");

// === Recommendation by use case ===
Console.WriteLine("\n=== Recommendation ===");
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

    === Problem: Typos in dicts are silent ===
    Dict typo:   silent bug → KeyNotFoundException at runtime
    Record typo: compile error → caught before code even runs
    
    === Problem: Dicts are opaque ===
    Dictionary:  no autocomplete — must memorize string keys
    Record:      IDE shows all properties on '.' → full autocomplete
                 record Order(int CustomerId, double Amount)
                 order.█  →  CustomerId, Amount (IDE suggests)
    
    === Problem: Renaming a field ===
    Dictionary:  search-and-replace "customer_id" strings across all files
                 miss one? Runtime crash
    Record:      right-click → Rename → all usages updated automatically
    
    === Problem: Invalid data passes silently ===
    Dictionary<string, object>: any garbage in, no error
    Record:                     wrong type = compile error
    
    === Problem: Comparing data ===
    dict1 == dict2:  False
    Records:         == compares VALUES (all fields checked automatically)
    
    === Recommendation ===
    
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
    
    


```csharp
// Records — auto-generated immutable data types (C# 9+)
//
// KEY CONCEPTS:
// - record: a reference type with auto-generated Equals, GetHashCode, ToString, and
//   non-destructive mutation (with expression). Python equivalent: @dataclass(frozen=True).
// - record struct: same but as a value type (lives on stack). Python: no equivalent.
// - Positional record: record Point(double X, double Y) — one-line declaration.
//   Auto-generates constructor, properties, Deconstruct, ToString, Equals.
// - with expression: creates a copy with some values changed (non-destructive).
//   Python equivalent: dataclass._replace() or copy + modify.
// - init-only property ({ get; init; }): can only be set during construction.
// - In DE: records are perfect for DTOs, configuration, API responses, immutable state.
// - DTO (Data Transfer Object): an object that only carries data, no logic.
//   Just a container for moving data between layers (DB → API → pipeline).
//
// WHY RECORD INSTEAD OF DICTIONARY?
//   Dictionary: dict["Name"] = "Alice"; dict["Emal"] = 30;  ← typo! No error, silent bug.
//   Record:     new Customer("Alice", 30, Emal: ...)          ← Compile error! Caught immediately.
//   - Dictionary: no autocomplete, everything is object (must cast), typos = runtime bugs
//   - Record: full autocomplete, type-safe, typos caught at compile time, self-documenting
//   - Dictionary: fine for dynamic/unknown structure (arbitrary JSON, config)
//   - Record: better for known, fixed structures (DB rows, API responses, pipeline data)

// === Positional record — one-line declaration ===
record Point(double X, double Y);

// === Record with defaults ===
record Employee(string Name, string Department, double Salary = 50000);

// === Record with body (additional members) ===
record Config(string Host, int Port, bool Ssl = true)
{
    // Computed property
    public string ConnectionString => $"{(Ssl ? "https" : "http")}://{Host}:{Port}";
}

// === Record struct (value type) ===
record struct Version(int Major, int Minor, int Patch);

// === Record with validation ===
record PipelineRecord(string TableName, int RowCount, string Status = "pending")
{
    public List<string> Errors { get; init; } = new();
    public bool IsSuccess => Status == "success" && Errors.Count == 0;
}
```




<div>

    <div id='dotnet-interactive-this-cell-$CACHE_BUSTER$' style='display: none'>

        The below script needs to be able to find the current output cell; this is an easy method to get it.

    </div>

    <script type='text/javascript'>

async function probeAddresses(probingAddresses) {

    function timeout(ms, promise) {

        return new Promise(function (resolve, reject) {

            setTimeout(function () {

                reject(new Error('timeout'))

            }, ms)

            promise.then(resolve, reject)

        })

    }



    if (Array.isArray(probingAddresses)) {

        for (let i = 0; i < probingAddresses.length; i++) {



            let rootUrl = probingAddresses[i];



            if (!rootUrl.endsWith('/')) {

                rootUrl = `${rootUrl}/`;

            }



            try {

                let response = await timeout(1000, fetch(`${rootUrl}discovery`, {

                    method: 'POST',

                    cache: 'no-cache',

                    mode: 'cors',

                    timeout: 1000,

                    headers: {

                        'Content-Type': 'text/plain'

                    },

                    body: probingAddresses[i]

                }));



                if (response.status == 200) {

                    return rootUrl;

                }

            }

            catch (e) { }

        }

    }

}



function loadDotnetInteractiveApi() {

    probeAddresses(["http://2a02:8308:718a:f200::655c:2048/","http://2a02:8308:718a:f200:8bd4:d06d:33ed:be05:2048/","http://2a02:8308:718a:f200:11f1:5c2e:7e82:d4f1:2048/","http://fe80::3212:d8da:d32d:4723%14:2048/","http://192.168.0.110:2048/","http://::1:2048/","http://127.0.0.1:2048/"])

        .then((root) => {

        // use probing to find host url and api resources

        // load interactive helpers and language services

        let dotnetInteractiveRequire = require.config({

        context: '16360.Microsoft.DotNet.Interactive.Http.HttpPort',

                paths:

            {

                'dotnet-interactive': `${root}resources`

                }

        }) || require;



            window.dotnetInteractiveRequire = dotnetInteractiveRequire;



            window.configureRequireFromExtension = function(extensionName, extensionCacheBuster) {

                let paths = {};

                paths[extensionName] = `${root}extensions/${extensionName}/resources/`;

                

                let internalRequire = require.config({

                    context: extensionCacheBuster,

                    paths: paths,

                    urlArgs: `cacheBuster=${extensionCacheBuster}`

                    }) || require;



                return internalRequire

            };

        

            dotnetInteractiveRequire([

                    'dotnet-interactive/dotnet-interactive'

                ],

                function (dotnet) {

                    dotnet.init(window);

                },

                function (error) {

                    console.log(error);

                }

            );

        })

        .catch(error => {console.log(error);});

    }



// ensure `require` is available globally

if ((typeof(require) !==  typeof(Function)) || (typeof(require.config) !== typeof(Function))) {

    let require_script = document.createElement('script');

    require_script.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js');

    require_script.setAttribute('type', 'text/javascript');

    

    

    require_script.onload = function() {

        loadDotnetInteractiveApi();

    };



    document.getElementsByTagName('head')[0].appendChild(require_script);

}

else {

    loadDotnetInteractiveApi();

}



    </script>

</div>



```csharp
// Using records (run previous cell first)
Console.WriteLine("=== Positional Record ===");
var p1 = new Point(3.0, 4.0);
var p2 = new Point(3.0, 4.0);
var p3 = new Point(1.0, 2.0);

Console.WriteLine($"p1:        {p1}");                     // auto ToString
Console.WriteLine($"p1 == p2:  {p1 == p2}");               // True! Value equality (not reference)
Console.WriteLine($"p1 == p3:  {p1 == p3}");               // False

// Deconstruction (auto-generated)
var (x, y) = p1;
Console.WriteLine($"Deconstructed: x={x}, y={y}");

// === 'with' expression — non-destructive mutation ===
Console.WriteLine("\n=== 'with' expression (copy + modify) ===");
var emp = new Employee("Alice", "Engineering", 95000);
var promoted = emp with { Salary = 110000 };               // creates NEW record
Console.WriteLine($"Original:  {emp}");
Console.WriteLine($"Promoted:  {promoted}");               // different salary
Console.WriteLine($"Same?      {emp == promoted}");        // False

// === Record with computed property ===
Console.WriteLine("\n=== Record with body ===");
var config = new Config("localhost", 5432);
Console.WriteLine($"Config: {config}");
Console.WriteLine($"ConnStr: {config.ConnectionString}");

// === Record struct (value type, comparable) ===
Console.WriteLine("\n=== Record struct ===");
var versions = new[] { new Version(2, 0, 0), new Version(1, 9, 5), new Version(2, 1, 0) };
// record structs don't auto-implement IComparable, but have value equality
Console.WriteLine($"v1 == v2: {new Version(1, 0, 0) == new Version(1, 0, 0)}");  // True

// === DE Use Case ===
Console.WriteLine("\n=== DE Use Case: Pipeline Record ===");
var records = new[]
{
    new PipelineRecord("users", 1000, "success"),
    new PipelineRecord("orders", 500, "failed") { Errors = new() { "timeout" } },
    new PipelineRecord("products", 200),
};
foreach (var r in records)
    Console.WriteLine($"  {r.TableName}: {r.Status} (ok={r.IsSuccess})");

// === record vs class vs struct ===
Console.WriteLine("\n=== When to use what ===");
Console.WriteLine("class:         mutable, identity-based equality, most OOP scenarios");
Console.WriteLine("record:        immutable, value-based equality, DTOs, config, events");
Console.WriteLine("record struct: same as record but value type (stack, no GC)");
Console.WriteLine("struct:        mutable value type (use record struct instead in new code)");
Console.WriteLine("");
Console.WriteLine("Python: @dataclass              → C#: record");
Console.WriteLine("Python: @dataclass(frozen=True)  → C#: record (immutable by default)");
Console.WriteLine("Python: @dataclass(order=True)   → C#: implement IComparable manually");
```

    === Positional Record ===
    p1:        Point { X = 3, Y = 4 }
    p1 == p2:  True
    p1 == p3:  False
    Deconstructed: x=3, y=4
    
    === 'with' expression (copy + modify) ===
    Original:  Employee { Name = Alice, Department = Engineering, Salary = 95000 }
    Promoted:  Employee { Name = Alice, Department = Engineering, Salary = 110000 }
    Same?      False
    
    === Record with body ===
    Config: Config { Host = localhost, Port = 5432, Ssl = True, ConnectionString = https://localhost:5432 }
    ConnStr: https://localhost:5432
    
    === Record struct ===
    v1 == v2: True
    
    === DE Use Case: Pipeline Record ===
      users: success (ok=True)
      orders: failed (ok=False)
      products: pending (ok=False)
    
    === When to use what ===
    class:         mutable, identity-based equality, most OOP scenarios
    record:        immutable, value-based equality, DTOs, config, events
    record struct: same as record but value type (stack, no GC)
    struct:        mutable value type (use record struct instead in new code)
    
    Python: @dataclass              → C#: record
    Python: @dataclass(frozen=True)  → C#: record (immutable by default)
    Python: @dataclass(order=True)   → C#: implement IComparable manually
    
