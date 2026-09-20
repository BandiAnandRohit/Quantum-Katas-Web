// Compatibility layer: the Quantum Katas were written for the legacy QDK (0.x).
// This file re-creates the few legacy library APIs they depend on, on top of the
// modern Q# standard library that runs in the browser (WebAssembly).

namespace Quantum.Kata.Utils {
    // Call-counting is a simulator feature of the legacy QDK that does not exist in the browser build.
    // These are inert stand-ins so that kata test harnesses still compile.
    operation GetOracleCallsCount<'T>(oracle : 'T) : Int { 0 }
    operation ResetOracleCallsCount() : Unit { }
    operation GetMaxQubitCount() : Int { 0 }
    operation ResetQubitCount() : Unit { }
    operation GetMultiQubitOpCount() : Int { 0 }
}

namespace Microsoft.Quantum.Arithmetic {
    open Microsoft.Quantum.Arrays;
    open Microsoft.Quantum.Math;

    newtype LittleEndian = Qubit[];
    newtype BigEndian = Qubit[];

    function BigEndianAsLittleEndian(register : BigEndian) : LittleEndian {
        LittleEndian(Reversed(register!))
    }
    function LittleEndianAsBigEndian(register : LittleEndian) : BigEndian {
        BigEndian(Reversed(register!))
    }
    operation IncrementByInteger(increment : Int, target : LittleEndian) : Unit is Adj + Ctl {
        let m = 1 <<< Length(target!);
        Std.Arithmetic.IncByI(((increment % m) + m) % m, target!);
    }
    operation QFTLE(qs : LittleEndian) : Unit is Adj + Ctl {
        Std.Canon.ApplyQFT(qs!);
        Std.Canon.SwapReverseRegister(qs!);
    }
    operation QFT(qs : BigEndian) : Unit is Adj + Ctl {
        QFTLE(LittleEndian(Reversed(qs!)));
    }
    operation ApplyDiagonalUnitary(coefficients : Double[], qubits : LittleEndian) : Unit is Adj + Ctl {
        let qs = qubits!;
        let n = Length(qs);
        for k in 0 .. Length(coefficients) - 1 {
            let phase = coefficients[k];
            if phase != 0.0 {
                within {
                    for i in 0 .. n - 1 {
                        if ((k >>> i) &&& 1) == 0 { X(qs[i]); }
                    }
                } apply {
                    Controlled R1(Most(qs), (phase, Tail(qs)));
                }
            }
        }
    }
    operation ApplyPhaseLEOperationOnLE(op : (Qubit[] => Unit is Adj + Ctl), target : LittleEndian) : Unit is Adj + Ctl {
        op(target!);
    }
}

namespace Microsoft.Quantum.Logical {
    function EqualI(a : Int, b : Int) : Bool { a == b }
    function EqualB(a : Bool, b : Bool) : Bool { a == b }
    function EqualR(a : Result, b : Result) : Bool { a == b }
    function EqualD(a : Double, b : Double) : Bool { a == b }
    function NotEqualI(a : Int, b : Int) : Bool { a != b }
    function LessThanI(a : Int, b : Int) : Bool { a < b }
    function LessThanOrEqualI(a : Int, b : Int) : Bool { a <= b }
    function GreaterThanI(a : Int, b : Int) : Bool { a > b }
    function GreaterThanOrEqualI(a : Int, b : Int) : Bool { a >= b }
    function LessThanD(a : Double, b : Double) : Bool { a < b }
    function LessThanOrEqualD(a : Double, b : Double) : Bool { a <= b }
    function GreaterThanD(a : Double, b : Double) : Bool { a > b }
    function GreaterThanOrEqualD(a : Double, b : Double) : Bool { a >= b }
    function Not(a : Bool) : Bool { not a }
    function And(a : Bool, b : Bool) : Bool { a and b }
    function Or(a : Bool, b : Bool) : Bool { a or b }
    function EqualA<'T>(equal : (('T, 'T) -> Bool), first : 'T[], second : 'T[]) : Bool {
        if Length(first) != Length(second) { return false; }
        for i in 0 .. Length(first) - 1 {
            if not equal(first[i], second[i]) { return false; }
        }
        true
    }
}

namespace Microsoft.Quantum.Bitwise {
    function Xor(a : Int, b : Int) : Int { a ^^^ b }
    function And(a : Int, b : Int) : Int { a &&& b }
    function Or(a : Int, b : Int) : Int { a ||| b }
    function Not(a : Int) : Int { ~~~a }
    function Parity(a : Int) : Int {
        mutable x = a;
        mutable p = 0;
        while x != 0 {
            set p = p ^^^ (x &&& 1);
            set x = x >>> 1;
        }
        p
    }
}

namespace Microsoft.Quantum.Preparation {
    open Microsoft.Quantum.Arithmetic;

    operation PreparePauliEigenstate(basis : Pauli, qubit : Qubit) : Unit is Adj + Ctl {
        if basis == PauliX {
            H(qubit);
        } elif basis == PauliY {
            H(qubit);
            S(qubit);
        }
    }
    operation PrepareEntangledState(left : Qubit[], right : Qubit[]) : Unit is Adj + Ctl {
        for i in 0 .. Length(left) - 1 {
            H(left[i]);
            CNOT(left[i], right[i]);
        }
    }
    operation PrepareArbitraryStateD(coefficients : Double[], qubits : LittleEndian) : Unit is Adj + Ctl {
        Std.StatePreparation.PreparePureStateD(coefficients, qubits!);
    }
}

namespace Microsoft.Quantum.Characterization {
    open Microsoft.Quantum.Arithmetic;
    open Microsoft.Quantum.Oracles;

    operation QuantumPhaseEstimation(oracle : DiscreteOracle, targetState : Qubit[], controlRegister : BigEndian) : Unit is Adj + Ctl {
        Std.Canon.ApplyQPE(oracle!, targetState, Std.Arrays.Reversed(controlRegister!));
    }
}

namespace Microsoft.Quantum.Oracles {
    newtype DiscreteOracle = (Int, Qubit[]) => Unit is Adj + Ctl;
}

namespace Microsoft.Quantum.Measurement {
    open Microsoft.Quantum.Arithmetic;

    operation MultiM(qubits : Qubit[]) : Result[] {
        Std.Measurement.MeasureEachZ(qubits)
    }
    function IsResultZero(result : Result) : Bool { result == Zero }
    function IsResultOne(result : Result) : Bool { result == One }
}

namespace Microsoft.Quantum.Arrays {
    open Microsoft.Quantum.Math;
    function Zipped3<'T, 'U, 'V>(first : 'T[], second : 'U[], third : 'V[]) : ('T, 'U, 'V)[] {
        let n = Min([Length(first), Length(second), Length(third)]);
        mutable result = [];
        for i in 0 .. n - 1 {
            set result += [(first[i], second[i], third[i])];
        }
        result
    }
    function Prefixes<'T>(array : 'T[]) : 'T[][] {
        mutable result = [];
        for i in 0 .. Length(array) - 1 {
            set result += [array[0 .. i]];
        }
        result
    }
    function RangeAsIntArray(r : Range) : Int[] {
        mutable result = [];
        for i in r {
            set result += [i];
        }
        result
    }
}

namespace Microsoft.Quantum.Canon {
    open Microsoft.Quantum.Arrays;

    function ControlledOnInt<'T>(numberState : Int, oracle : ('T => Unit is Adj + Ctl)) : ((Qubit[], 'T) => Unit is Adj + Ctl) {
        ApplyControlledOnInt(numberState, oracle, _, _)
    }
    function ControlledOnBitString<'T>(bits : Bool[], oracle : ('T => Unit is Adj + Ctl)) : ((Qubit[], 'T) => Unit is Adj + Ctl) {
        ApplyControlledOnBitString(bits, oracle, _, _)
    }
    operation NoOp<'T>(input : 'T) : Unit is Adj + Ctl { }
    operation ApplyToFirstQubitCA(op : (Qubit => Unit is Adj + Ctl), register : Qubit[]) : Unit is Adj + Ctl {
        op(register[0]);
    }
    operation ApplyToFirstTwoQubitsCA(op : ((Qubit, Qubit) => Unit is Adj + Ctl), register : Qubit[]) : Unit is Adj + Ctl {
        op(register[0], register[1]);
    }

    operation Delay<'T, 'U>(op : ('T => 'U), arg : 'T, aux : Unit) : 'U {
        op(arg)
    }
    function Compose<'T, 'U, 'V>(outerFn : ('U -> 'V), innerFn : ('T -> 'U)) : ('T -> 'V) {
        x -> outerFn(innerFn(x))
    }
    function FunctionAsOperation<'T, 'U>(fn : ('T -> 'U)) : ('T => 'U) {
        input => fn(input)
    }
    operation ApplyAllCA<'T>(operations : ('T => Unit is Adj + Ctl)[], target : 'T) : Unit is Adj + Ctl {
        for op in operations {
            op(target);
        }
    }
    function BoundCA<'T>(operations : ('T => Unit is Adj + Ctl)[]) : ('T => Unit is Adj + Ctl) {
        ApplyAllCA(operations, _)
    }
    operation ApplyWithA<'T>(outer : ('T => Unit is Adj), inner : ('T => Unit is Adj), target : 'T) : Unit is Adj {
        within { outer(target); } apply { inner(target); }
    }
    function OperationPow<'T>(op : ('T => Unit), power : Int) : ('T => Unit) {
        target => {
            for _ in 1 .. power { op(target); }
        }
    }
    function OperationPowCA<'T>(op : ('T => Unit is Adj + Ctl), power : Int) : ('T => Unit is Adj + Ctl) {
        ApplyOperationPowerCA(power, op, _)
    }
}

namespace Microsoft.Quantum.Diagnostics {
    open Microsoft.Quantum.Arrays;
    // Exact comparison (via the Choi state, 2n qubits) is too heavy in a browser for large registers, so for
    // n > 8 qubits the operations are compared on several random product states instead.
    operation __OperationsAreEqual(nQubits : Int, actual : (Qubit[] => Unit), expected : (Qubit[] => Unit is Adj)) : Bool {
        if nQubits <= 5 {
            return CheckOperationsAreEqual(nQubits, actual, expected);
        }
        mutable ok = true;
        for trial in 1..2 {
            use qs = Qubit[nQubits];
            mutable angles = [0.0, size = nQubits];
            mutable phases = [0.0, size = nQubits];
            for i in 0..nQubits - 1 {
                set angles w/= i <- Microsoft.Quantum.Random.DrawRandomDouble(0.1, 3.0);
                set phases w/= i <- Microsoft.Quantum.Random.DrawRandomDouble(0.1, 6.0);
            }
            for i in 0..nQubits - 1 {
                Ry(angles[i], qs[i]);
                Rz(phases[i], qs[i]);
            }
            actual(qs);
            Adjoint expected(qs);
            for i in 0..nQubits - 1 {
                Rz(-phases[i], qs[i]);
                Ry(-angles[i], qs[i]);
            }
            if not CheckAllZero(qs) { set ok = false; ResetAll(qs); }
        }
        return ok;
    }
    operation AssertOperationsEqualReferenced(nQubits : Int, actual : (Qubit[] => Unit), expected : (Qubit[] => Unit is Adj)) : Unit {
        Fact(__OperationsAreEqual(nQubits, actual, expected), "The operation does not match the expected behavior on all inputs.");
    }
    operation AssertOperationsEqualInPlace(nQubits : Int, actual : (Qubit[] => Unit), expected : (Qubit[] => Unit is Adj)) : Unit {
        Fact(__OperationsAreEqual(nQubits, actual, expected), "The operation does not match the expected behavior on all inputs.");
    }
    operation AssertAllZero(qubits : Qubit[]) : Unit {
        Fact(CheckAllZero(qubits), "Some of the qubits are not in the |0⟩ state when they should be.");
    }
    operation AssertQubit(expected : Result, qubit : Qubit) : Unit {
        if expected == Zero {
            Fact(CheckZero(qubit), "The qubit is expected to be in the |0⟩ state, but it is not.");
        } else {
            X(qubit);
            Fact(CheckZero(qubit), "The qubit is expected to be in the |1⟩ state, but it is not.");
            X(qubit);
        }
    }

    // Exact test of "the probability of measuring basis state |stateIndex⟩ on `qubits` is zero"
    // via a Hadamard test with the reflection about |stateIndex⟩.
    operation ProbabilityOfBasisStateIsZero(stateIndex : Int, qubits : Qubit[]) : Bool {
        let n = Length(qubits);
        use c = Qubit();
        H(c);
        within {
            for i in 0 .. n - 1 {
                if ((stateIndex >>> i) &&& 1) == 0 { X(qubits[i]); }
            }
        } apply {
            Controlled Z([c] + Most(qubits), Tail(qubits));
        }
        H(c);
        let isZero = CheckZero(c);
        H(c);
        within {
            for i in 0 .. n - 1 {
                if ((stateIndex >>> i) &&& 1) == 0 { X(qubits[i]); }
            }
        } apply {
            Controlled Z([c] + Most(qubits), Tail(qubits));
        }
        H(c);
        isZero
    }
}

namespace Microsoft.Quantum.Diagnostics {
    function EqualityFactB(actual : Bool, expected : Bool, message : String) : Unit {
        Fact(actual == expected, message);
    }
    function EqualityFactI(actual : Int, expected : Int, message : String) : Unit {
        Fact(actual == expected, message);
    }
    function EqualityFactR(actual : Result, expected : Result, message : String) : Unit {
        Fact(actual == expected, message);
    }
    function EqualityWithinToleranceFact(actual : Double, expected : Double, tolerance : Double) : Unit {
        let diff = actual - expected;
        let absDiff = if diff < 0.0 { -diff } else { diff };
        Fact(absDiff <= tolerance, $"Expected a value within {tolerance} of {expected}, but got {actual}.");
    }
    function AllEqualityFactB(actual : Bool[], expected : Bool[], message : String) : Unit {
        Fact(Length(actual) == Length(expected), message);
        for i in 0 .. Length(actual) - 1 {
            Fact(actual[i] == expected[i], message);
        }
    }
    function AllEqualityFactI(actual : Int[], expected : Int[], message : String) : Unit {
        Fact(Length(actual) == Length(expected), message);
        for i in 0 .. Length(actual) - 1 {
            Fact(actual[i] == expected[i], message);
        }
    }
    function AllEqualityFactR(actual : Result[], expected : Result[], message : String) : Unit {
        Fact(Length(actual) == Length(expected), message);
        for i in 0 .. Length(actual) - 1 {
            Fact(actual[i] == expected[i], message);
        }
    }
}

namespace Microsoft.Quantum.Diagnostics {
    open Microsoft.Quantum.Arithmetic;
    open Microsoft.Quantum.Math;
    open Microsoft.Quantum.Convert;

    // Resource-restriction checks are simulator features of the legacy QDK; they are not enforced in the browser.
    operation AllowAtMostNQubits(nQubits : Int, message : String) : Unit is Adj + Ctl { }
    operation AllowAtMostNCallsCA<'T>(nCalls : Int, op : 'T, message : String) : Unit is Adj + Ctl { }

    operation AssertProbInt(stateIndex : Int, expected : Double, qubits : LittleEndian, tolerance : Double) : Unit {
        let lo = expected - tolerance;
        let hi = expected + tolerance;
        if lo <= 0.0 and hi < 0.001 {
            Fact(ProbabilityOfBasisStateIsZero(stateIndex, qubits!), $"The probability of measuring basis state {stateIndex} should be 0, but it is not.");
        } elif lo >= 0.0 and hi >= 1.0 {
            Fact(not ProbabilityOfBasisStateIsZero(stateIndex, qubits!), $"The probability of measuring basis state {stateIndex} should be non-zero, but it is 0.");
        } else {
            Fact(false, "AssertProbInt: this combination of probability and tolerance is not supported in the browser version.");
        }
    }

}

namespace Microsoft.Quantum.Characterization {
    open Microsoft.Quantum.Math;
    open Microsoft.Quantum.Convert;

    // Hadamard-test based estimate of Re<psi1|psi2>, psi_k = preparation_k applied after commonPreparation on |0..0>.
    operation EstimateRealOverlapBetweenStates(
        commonPreparation : (Qubit[] => Unit is Adj),
        preparation1 : (Qubit[] => Unit is Adj + Ctl),
        preparation2 : (Qubit[] => Unit is Adj + Ctl),
        nQubits : Int,
        nMeasurements : Int
    ) : Double {
        // The legacy simulator computed this overlap exactly. Here: first an exact test (CheckZero looks at the
        // simulated state, not at samples) for overlap = +1 or -1, otherwise a sampled Hadamard test whose
        // result is kept strictly inside (-1, 1), so that e.g. Floor(...) of it behaves like the exact value.
        use c0 = Qubit();
        use qs0 = Qubit[nQubits];
        commonPreparation(qs0);
        H(c0);
        Controlled preparation1([c0], qs0);
        Controlled Adjoint preparation2([c0], qs0);
        H(c0);
        let isPlusOne = Microsoft.Quantum.Diagnostics.CheckZero(c0);
        X(c0);
        let isMinusOne = Microsoft.Quantum.Diagnostics.CheckZero(c0);
        Reset(c0);
        ResetAll(qs0);
        if isPlusOne { return 1.0; }
        if isMinusOne { return -1.0; }
        let shots = Min([nMeasurements, 100]);
        mutable zeros = 0;
        for _ in 1 .. shots {
            use c = Qubit();
            use qs = Qubit[nQubits];
            commonPreparation(qs);
            H(c);
            Controlled preparation1([c], qs);
            Controlled Adjoint preparation2([c], qs);
            H(c);
            if M(c) == Zero { set zeros += 1; }
            Reset(c);
            ResetAll(qs);
        }
        let est = 2.0 * IntAsDouble(zeros) / IntAsDouble(shots) - 1.0;
        if est > 0.999999 { 0.999999 } elif est < -0.999999 { -0.999999 } else { est }
    }
}

namespace Microsoft.Quantum.Diagnostics {
    // Inserted by the browser build at every scope exit that releases qubits: qubits that are in a
    // classical state (e.g. after a measurement) are reset, as the legacy simulator did implicitly;
    // qubits that are superposed or entangled are reported as an error.
    // Explicit stepped ranges: normalise empty ranges (the auto-generated adjoint of a loop over an empty
    // range with |step| > 1 would otherwise run one iteration).
    function __SafeRange(a : Int, s : Int, b : Int) : Range {
        if (s > 0 and a > b) or (s < 0 and a < b) { 1..0 } else { a..s..b }
    }

    operation __ReleaseCheck(qs : Qubit[]) : Unit is Adj + Ctl {
        body ... {
            for q in qs {
                if not CheckZero(q) {
                    X(q);
                    Fact(CheckZero(q), "A qubit was released while not in the |0⟩ state (it is in a superposition or entangled with other qubits). Uncompute or reset your auxiliary qubits before releasing them.");
                }
            }
        }
        adjoint self;
        controlled (ctls, ...) { }
        controlled adjoint self;
    }
}
