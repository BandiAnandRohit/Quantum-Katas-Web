// The suggested learning path of the Quantum Katas (from the upstream README), as a machine-readable list.
export const GROUPS = [
  {
    id: "qubits-gates",
    title: "Qubits and gates",
    lessons: [
      { id: "ComplexArithmetic", kind: "tutorial", dir: "tutorials/ComplexArithmetic", notebooks: ["ComplexArithmetic.ipynb"], title: "Complex arithmetic", summary: "The mathematics of complex numbers needed for quantum computing." },
      { id: "LinearAlgebra", kind: "tutorial", dir: "tutorials/LinearAlgebra", notebooks: ["LinearAlgebra.ipynb"], title: "Linear algebra", summary: "Vectors and matrices, which represent quantum states and operations." },
      { id: "Qubit", kind: "tutorial", dir: "tutorials/Qubit", notebooks: ["Qubit.ipynb"], title: "The qubit", summary: "What a qubit is and how its state is described." },
      { id: "SingleQubitGates", kind: "tutorial", dir: "tutorials/SingleQubitGates", notebooks: ["SingleQubitGates.ipynb"], title: "Single-qubit gates", summary: "What a quantum gate is, and the most common single-qubit gates." },
      { id: "BasicGates", kind: "kata", dir: "BasicGates", notebooks: ["BasicGates.ipynb"], title: "Basic gates", summary: "Apply the most common gates to transform qubit states." },
      { id: "MultiQubitSystems", kind: "tutorial", dir: "tutorials/MultiQubitSystems", notebooks: ["MultiQubitSystems.ipynb"], title: "Multi-qubit systems", summary: "How to represent systems of several qubits." },
      { id: "MultiQubitGates", kind: "tutorial", dir: "tutorials/MultiQubitGates", notebooks: ["MultiQubitGates.ipynb"], title: "Multi-qubit gates", summary: "CNOT, SWAP, controlled gates and more." },
      { id: "Superposition", kind: "kata", dir: "Superposition", notebooks: ["Superposition.ipynb"], title: "Superposition", summary: "Prepare a wide variety of superposition states." },
    ],
  },
  {
    id: "measurements",
    title: "Measurements",
    lessons: [
      { id: "SingleQubitSystemMeasurements", kind: "tutorial", dir: "tutorials/SingleQubitSystemMeasurements", notebooks: ["SingleQubitSystemMeasurements.ipynb"], title: "Single-qubit measurements", summary: "What quantum measurement is and how it works on one qubit." },
      { id: "MultiQubitSystemMeasurements", kind: "tutorial", dir: "tutorials/MultiQubitSystemMeasurements", notebooks: ["MultiQubitSystemMeasurements.ipynb"], title: "Multi-qubit measurements", summary: "Full and partial measurements on multi-qubit systems." },
      { id: "Measurements", kind: "kata", dir: "Measurements", notebooks: ["Measurements.ipynb"], title: "Measurements", summary: "Distinguish quantum states using measurements." },
      { id: "DistinguishUnitaries", kind: "kata", dir: "DistinguishUnitaries", notebooks: ["DistinguishUnitaries.ipynb"], title: "Distinguish unitaries", summary: "Design experiments that tell unitary operations apart.", advanced: true },
      { id: "JointMeasurements", kind: "kata", dir: "JointMeasurements", notebooks: ["JointMeasurements.ipynb"], title: "Joint measurements", summary: "Use joint (parity) measurements to distinguish states and transform them.", advanced: true },
    ],
  },
  {
    id: "tools",
    title: "Q# tools",
    lessons: [
      { id: "VisualizationTools", kind: "tutorial", dir: "tutorials/VisualizationTools", notebooks: ["VisualizationTools.ipynb"], title: "Visualization tools", summary: "Tools for visualizing the elements of Q# programs." },
    ],
  },
  {
    id: "simple-algorithms",
    title: "Simple algorithms",
    lessons: [
      { id: "RandomNumberGeneration", kind: "tutorial", dir: "tutorials/RandomNumberGeneration", notebooks: ["RandomNumberGenerationTutorial.ipynb"], title: "Random number generation", summary: "Generate random numbers with the principles of quantum computing." },
      { id: "Teleportation", kind: "kata", dir: "Teleportation", notebooks: ["Teleportation.ipynb"], title: "Teleportation", summary: "The standard teleportation protocol and its variations." },
      { id: "SuperdenseCoding", kind: "kata", dir: "SuperdenseCoding", notebooks: ["SuperdenseCoding.ipynb"], title: "Superdense coding", summary: "Send two classical bits using one qubit." },
    ],
  },
  {
    id: "oracles",
    title: "Oracles and simple oracle algorithms",
    lessons: [
      { id: "Oracles", kind: "tutorial", dir: "tutorials/Oracles", notebooks: ["Oracles.ipynb"], title: "Quantum oracles", summary: "Implement classical functions as quantum oracles." },
      { id: "MarkingOracles", kind: "kata", dir: "MarkingOracles", notebooks: ["MarkingOracles.ipynb"], title: "Marking oracles", summary: "Practice marking oracles for a variety of classical functions." },
      { id: "ExploringDeutschJozsaAlgorithm", kind: "tutorial", dir: "tutorials/ExploringDeutschJozsaAlgorithm", notebooks: ["DeutschJozsaAlgorithmTutorial_P1.ipynb", "DeutschJozsaAlgorithmTutorial_P2.ipynb", "DeutschJozsaAlgorithmTutorial_P3.ipynb"], title: "Exploring Deutsch–Jozsa", summary: "Compare the quantum solution of the Deutsch–Jozsa problem to a classical one." },
      { id: "DeutschJozsaAlgorithm", kind: "kata", dir: "DeutschJozsaAlgorithm", notebooks: ["DeutschJozsaAlgorithm.ipynb"], title: "Deutsch–Jozsa algorithm", summary: "Implement Bernstein–Vazirani and Deutsch–Jozsa." },
      { id: "SimonsAlgorithm", kind: "kata", dir: "SimonsAlgorithm", notebooks: [], title: "Simon's algorithm", summary: "Simon's algorithm and the oracles it works with.", advanced: true },
    ],
  },
  {
    id: "grover",
    title: "Grover's search",
    lessons: [
      { id: "GroversAlgorithm", kind: "kata", dir: "GroversAlgorithm", notebooks: ["GroversAlgorithm.ipynb"], title: "Implementing Grover's algorithm", summary: "Grover's search and how to write oracles for it." },
      { id: "ExploringGroversAlgorithm", kind: "tutorial", dir: "tutorials/ExploringGroversAlgorithm", notebooks: ["ExploringGroversAlgorithmTutorial.ipynb", "VisualizingGroversAlgorithm.ipynb"], title: "Exploring Grover's search", summary: "Pick up where the Grover kata left off." },
      { id: "SolveSATWithGrover", kind: "kata", dir: "SolveSATWithGrover", notebooks: ["SolveSATWithGrover.ipynb"], title: "Solving SAT with Grover", summary: "Oracles from problem descriptions; unknown numbers of solutions." },
      { id: "GraphColoring", kind: "kata", dir: "GraphColoring", notebooks: ["GraphColoring.ipynb"], title: "Graph coloring with Grover", summary: "Grover's search applied to graph colouring." },
      { id: "BoundedKnapsack", kind: "kata", dir: "BoundedKnapsack", notebooks: ["BoundedKnapsack.ipynb"], title: "Bounded knapsack with Grover", summary: "Variants of the knapsack problem solved with Grover.", advanced: true },
    ],
  },
  {
    id: "shor",
    title: "Building up to Shor's algorithm",
    lessons: [
      { id: "QFT", kind: "kata", dir: "QFT", notebooks: ["QFT.ipynb"], title: "Quantum Fourier transform", summary: "Implement the QFT and use it for simple state transformations." },
      { id: "PhaseEstimation", kind: "kata", dir: "PhaseEstimation", notebooks: ["PhaseEstimation.ipynb"], title: "Phase estimation", summary: "Phase estimation algorithms." },
    ],
  },
  {
    id: "games",
    title: "Entanglement games",
    lessons: [
      { id: "CHSHGame", kind: "kata", dir: "CHSHGame", notebooks: ["CHSHGame.ipynb"], title: "CHSH game", summary: "Beat the classical bound with entanglement." },
      { id: "GHZGame", kind: "kata", dir: "GHZGame", notebooks: ["GHZGame.ipynb"], title: "GHZ game", summary: "A three-player entanglement game." },
      { id: "MagicSquareGame", kind: "kata", dir: "MagicSquareGame", notebooks: ["MagicSquareGame.ipynb"], title: "Mermin–Peres magic square", summary: "A game that only quantum strategies can win every time." },
    ],
  },
  {
    id: "reversible",
    title: "Reversible computing",
    lessons: [
      { id: "TruthTables", kind: "kata", dir: "TruthTables", notebooks: ["TruthTables.ipynb"], title: "Truth tables", summary: "Represent Boolean functions as truth tables and implement them as quantum operations." },
      { id: "RippleCarryAdder", kind: "kata", dir: "RippleCarryAdder", notebooks: ["RippleCarryAdder.ipynb"], title: "Ripple-carry adder", summary: "Build an adder on a quantum computer.", advanced: true },
    ],
  },
  {
    id: "misc",
    title: "Miscellaneous",
    lessons: [
      { id: "KeyDistribution_BB84", kind: "kata", dir: "KeyDistribution_BB84", notebooks: ["KeyDistribution_BB84.ipynb"], title: "BB84 key distribution", summary: "Implement the BB84 quantum key distribution protocol." },
      { id: "QEC_BitFlipCode", kind: "kata", dir: "QEC_BitFlipCode", notebooks: ["QEC_BitFlipCode.ipynb"], title: "Bit-flip error correcting code", summary: "A 3-qubit code for protecting against bit-flip errors." },
      { id: "UnitaryPatterns", kind: "kata", dir: "UnitaryPatterns", notebooks: ["UnitaryPatterns.ipynb"], title: "Unitary patterns", summary: "Implement unitaries whose matrices follow patterns of zero and non-zero elements." },
      { id: "QuantumClassification", kind: "tutorial", dir: "tutorials/QuantumClassification", notebooks: ["ExploringQuantumClassificationLibrary.ipynb", "InsideQuantumClassifiers.ipynb", "QuantumClassificationWithFeatureEngineering.ipynb"], title: "Quantum classification", summary: "Circuit-centric classifiers and the QDK machine learning library.", readOnly: true },
    ],
  },
];

export const ALL_LESSONS = GROUPS.flatMap((g) => g.lessons.map((l) => ({ ...l, group: g.id })));
