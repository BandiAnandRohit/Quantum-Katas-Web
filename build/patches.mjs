// Small, explicit adaptations of the original kata sources for the modern in-browser Q# compiler.
// Each patch is { file, find, replace } (exact string) or { file, op, source } (replace a whole operation).
// The build fails loudly if a patch no longer applies, so nothing is silently skipped.
export const PATCHES = {
  KeyDistribution_BB84: [
    {
      file: "Tests.qs",
      op: "T12_EqualSuperposition",
      source: `operation T12_EqualSuperposition () : Unit {
        // The legacy test asserted the measurement probability exactly; here we sample it many times.
        use q0 = Qubit();
        EqualSuperposition(q0);
        DumpMachine();
        Reset(q0);
        mutable ones = 0;
        let runs = 2000;
        for _ in 1 .. runs {
            use q = Qubit();
            EqualSuperposition(q);
            if MResetZ(q) == One { set ones += 1; }
        }
        let freq = IntAsDouble(ones) / IntAsDouble(runs);
        Fact(AbsD(freq - 0.5) < 0.05, $"Measuring should produce 0 and 1 with 50/50 chance, but got One in {freq} of the runs.");
    }`,
    },
  ],
  DistinguishUnitaries: [
    // The legacy simulator computed the overlap exactly (Floor gave 1 only for overlap = 1); in the browser it is
    // estimated, so compare with 1 explicitly instead of taking the Floor of a noisy estimate.
    {
      file: "ReferenceImplementation.qs",
      find: `return Floor(EstimateRealOverlapBetweenStates(ApplyToEachA(H, _), ApplyToEachCA(unitary, _), ApplyToEachCA(R1(theta, _), _), 1, 100000));`,
      replace: `return EstimateRealOverlapBetweenStates(ApplyToEachA(H, _), ApplyToEachCA(unitary, _), ApplyToEachCA(R1(theta, _), _), 1, 100000) >= 1.0 ? 1 | 0;`,
    },
  ],
  CHSHGame: [
    // 10000 random games: the statistical noise alone exceeded the original tolerance in ~3% of runs
    { file: "Tests.qs", find: `EqualityWithinToleranceFact(IntAsDouble(wins) / 10000., 0.85, 0.01);`, replace: `EqualityWithinToleranceFact(IntAsDouble(wins) / 10000., 0.85, 0.02);` },
  ],
  GraphColoring: [
    // The original test builds a bit string of length N + 2 for an N-qubit register (a bug in the source repository).
    { file: "Tests.qs", find: `[false, false] + IntAsBoolArray(k, N)`, replace: `[false, false] + IntAsBoolArray(k, N - 2)` },
  ],
  PhaseEstimation: [
    // Counting calls of Controlled U needs the legacy counting simulator; not available in the browser.
    { file: "Tests.qs", find: `EqualityFactI(nu, 1, $"You are allowed to call Controlled U exactly once, and you called it {nu} times");`, replace: `// (the "exactly one call of Controlled U" rule cannot be enforced in the browser version)` },
    { file: "Tests.qs", find: `$"Unexpected return for ({U}, {P}): expected {expected}, got {actual}"`, replace: `$"Unexpected return: expected {expected}, got {actual}"` },
  ],
  SuperdenseCoding: [
    { file: "Tests.qs", find: `$"{data} was transfered incorrectly as {result}"`, replace: `$"({data::Bit1}, {data::Bit2}) was transfered incorrectly as ({result::Bit1}, {result::Bit2})"` },
  ],
  TruthTables: [
    { file: "Tests.qs", find: `Message($"Testing on truth table {testTT}");`, replace: `Message("Testing on the truth table of \\"if x1 then x2 else x3\\"");` },
  ],
};

// Text replacements inside demo cells of the tutorials (notebook cells that are not kata tasks).
export const CELL_PATCHES = {
  MultiQubitSystems: [
    {
      find: `    Message("Let's try to examine one of two entangled qubits on its own...");\n    DumpRegister((), [qs[0]]);`,
      replace: `    Message("Let's try to examine one of two entangled qubits on its own...");\n    // In the original Jupyter version DumpRegister printed a message here. The modern compiler stops with an error\n    // ("qubits are not separable") for a qubit that is entangled with the others, so the call is commented out:\n    // DumpRegister([qs[0]]);\n    Message("The first qubit cannot be described on its own, because it is entangled with the second one.");`,
    },
  ],
};
