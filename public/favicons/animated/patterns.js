/**
 * Hybrid Patterns for Concept 3: Combined behaviors from Patterns A, B, and C
 * These patterns combine neural bursts, emergent clusters, and cascade propagation
 * Creating more complex, evolved-looking animations
 */

// Helper function to generate connections (from original)
function generateConnections(state) {
  const connections = [];
  const threshold = 0.5;

  for (let i = 0; i < state.length; i++) {
    for (let j = 0; j < state[i].length; j++) {
      if (state[i][j] > threshold) {
        // Connect to active neighbors
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            const ni = i + di;
            const nj = j + dj;
            if (
              ni >= 0 &&
              ni < state.length &&
              nj >= 0 &&
              nj < state[i].length &&
              state[ni][nj] > threshold
            ) {
              connections.push({
                from: { x: j, y: i },
                to: { x: nj, y: ni },
                strength: (state[i][j] + state[ni][nj]) / 2,
              });
            }
          }
        }
      }
    }
  }

  // Remove duplicate connections
  const uniqueConnections = [];
  const seen = new Set();
  connections.forEach((conn) => {
    const key = `${Math.min(conn.from.x, conn.to.x)}-${Math.min(
      conn.from.y,
      conn.to.y,
    )}-${Math.max(conn.from.x, conn.to.x)}-${Math.max(conn.from.y, conn.to.y)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueConnections.push(conn);
    }
  });

  return uniqueConnections.slice(0, 6); // Limit connections for clarity
}

// Hybrid 1: Adaptive Neural Clusters
// Combines Pattern A's neighbor influence with Pattern B's cluster formation
function generateHybrid1() {
  const frames = [];
  const gridSize = 4;
  let previousState = Array(gridSize)
    .fill()
    .map(() => Array(gridSize).fill(0));
  let clusterCenters = [];

  for (let frame = 0; frame < 12; frame++) {
    const newState = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Update cluster centers based on previous activity (adaptive)
    if (frame % 4 === 0 || clusterCenters.length === 0) {
      clusterCenters = [];
      // Find high activity areas from previous state
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (previousState[i][j] > 0.6 && Math.random() < 0.5) {
            clusterCenters.push({
              x: j,
              y: i,
              strength: 0.7 + Math.random() * 0.3,
              radius: 1.5,
            });
          }
        }
      }
      // Add at least one random cluster if none exist
      if (clusterCenters.length === 0) {
        clusterCenters.push({
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize),
          strength: 0.8,
          radius: 1.5,
        });
      }
    }

    // Apply cluster influence
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let clusterInfluence = 0;

        // Calculate cluster influence
        clusterCenters.forEach((cluster) => {
          const dist = Math.sqrt(
            Math.pow(i - cluster.y, 2) + Math.pow(j - cluster.x, 2),
          );
          if (dist <= cluster.radius) {
            clusterInfluence = Math.max(
              clusterInfluence,
              cluster.strength * (1 - dist / cluster.radius),
            );
          }
        });

        // Count active neighbors (Pattern A behavior)
        let activeNeighbors = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
              if (previousState[ni][nj] > 0.5) activeNeighbors++;
            }
          }
        }

        // Combine influences
        const neighborInfluence = activeNeighbors * 0.12;
        const decayFactor = previousState[i][j] * 0.3;
        const totalInfluence = clusterInfluence * 0.6 + neighborInfluence * 0.4;
        const activationProb = totalInfluence - decayFactor + 0.1;

        if (Math.random() < activationProb) {
          newState[i][j] = Math.min(1, totalInfluence + Math.random() * 0.3);
          if (newState[i][j] > 0.7) {
            spikes.push({
              x: j,
              y: i,
              intensity: newState[i][j],
              type: clusterInfluence > neighborInfluence ? "pulse" : "star",
            });
          }
        } else if (previousState[i][j] > 0) {
          newState[i][j] = previousState[i][j] * 0.5;
        }
      }
    }

    // Drift cluster centers slightly
    clusterCenters = clusterCenters.map((cluster) => ({
      ...cluster,
      x: Math.max(
        0,
        Math.min(gridSize - 1, cluster.x + (Math.random() - 0.5) * 0.5),
      ),
      y: Math.max(
        0,
        Math.min(gridSize - 1, cluster.y + (Math.random() - 0.5) * 0.5),
      ),
      strength: cluster.strength * 0.95,
    }));

    frames.push({
      cells: newState,
      spikes: spikes,
      connections: generateConnections(newState),
    });

    previousState = newState;
  }

  return frames;
}

// Hybrid 2: Cascading Burst Networks (Static Version)
// Combines Pattern A's neural bursts with Pattern C's cascade propagation
function generateStaticHybrid2() {
  const frames = [];
  const gridSize = 4;
  let previousState = Array(gridSize)
    .fill()
    .map(() => Array(gridSize).fill(0));
  let cascades = [];

  for (let frame = 0; frame < 12; frame++) {
    const newState = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Neural burst activation (Pattern A)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let activeNeighbors = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
              if (previousState[ni][nj] > 0.5) activeNeighbors++;
            }
          }
        }

        const baseProb = 0.1;
        const neighborInfluence = activeNeighbors * 0.15;
        const decayFactor = previousState[i][j] * 0.4;
        const burstProb = baseProb + neighborInfluence - decayFactor;

        if (Math.random() < burstProb) {
          newState[i][j] = 0.6 + Math.random() * 0.4;

          // High activity triggers cascade
          if (newState[i][j] > 0.8 && Math.random() < 0.5) {
            cascades.push({
              x: j,
              y: i,
              age: 0,
              strength: newState[i][j],
            });
          }
        } else if (previousState[i][j] > 0) {
          newState[i][j] = previousState[i][j] * 0.6;
        }
      }
    }

    // Process cascades (Pattern C behavior)
    const newCascades = [];
    cascades.forEach((cascade) => {
      if (cascade.age < 3) {
        const intensity = cascade.strength * (1 - cascade.age / 3);

        // Apply cascade to cell
        newState[cascade.y][cascade.x] = Math.max(
          newState[cascade.y][cascade.x],
          intensity,
        );

        spikes.push({
          x: cascade.x,
          y: cascade.y,
          intensity: intensity,
          type: "cascade",
          age: cascade.age,
        });

        // Propagate cascade
        if (cascade.age === 0) {
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              if (Math.abs(di) + Math.abs(dj) !== 1) continue; // Only orthogonal
              const ni = cascade.y + di;
              const nj = cascade.x + dj;
              if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                if (Math.random() < 0.6) {
                  newCascades.push({
                    x: nj,
                    y: ni,
                    age: 0,
                    strength: cascade.strength * 0.8,
                  });
                }
              }
            }
          }
        }

        cascade.age++;
        if (cascade.age < 3) {
          newCascades.push(cascade);
        }
      }
    });

    cascades = newCascades.slice(0, 8); // Limit cascade count

    frames.push({
      cells: newState,
      spikes: spikes,
      connections: generateConnections(newState),
    });

    previousState = newState;
  }

  return frames;
}

// Helper function to get evolution phase parameters
function getEvolutionPhase(generation) {
  const phaseIndex = generation % 6;
  return {
    index: phaseIndex,
    isComplexifying: phaseIndex <= 1,
    isSimplifying: phaseIndex >= 3 && phaseIndex <= 4,
    isTransition: phaseIndex === 2 || phaseIndex === 5,
    name:
      phaseIndex <= 1
        ? "complexify"
        : phaseIndex === 2
          ? "peak"
          : phaseIndex <= 4
            ? "simplify"
            : "valley",
  };
}

// Helper function to inject life seeds when pattern is dying
function injectRandomSeeds(state) {
  const gridSize = state.length;
  const newState = state.map((row) => [...row]);

  // Add 2-3 random active cells
  const seedCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < seedCount; i++) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    newState[y][x] = 0.6 + Math.random() * 0.4; // Strong seed
  }

  return newState;
}

// Helper function to cool down oversaturated patterns
function applyCooling(state) {
  return state.map((row) =>
    row.map((val) => (val > 0.8 ? val * 0.5 + 0.2 : val)),
  );
}

// Hybrid 2: Continuous Cascading Burst Networks
// Dynamic version that evolves from previous state with complexity cycles
function generateContinuousHybrid2(
  initialState = null,
  initialCascades = [],
  frameCount = 12,
  generation = 1,
) {
  const frames = [];
  const gridSize = 4;

  // Get evolution phase for this generation
  const phase = getEvolutionPhase(generation);

  // Phase-aware parameters
  const inheritanceRatio = phase.isSimplifying ? 0.4 : 0.7;
  const randomnessRatio = phase.isSimplifying
    ? 0.2
    : phase.isComplexifying
      ? 0.25
      : 0.15;
  const maxCascades = phase.isSimplifying ? 3 : phase.isComplexifying ? 7 : 5;
  const propagationBase = phase.isSimplifying ? 0.3 : 0.5;

  // Initialize from previous state or create random start
  let previousState;
  if (
    initialState &&
    initialState.length === gridSize &&
    initialState[0].length === gridSize
  ) {
    // Apply phase-aware inheritance
    previousState = initialState.map((row) =>
      row.map(
        (val) => val * inheritanceRatio + Math.random() * randomnessRatio,
      ),
    );

    // Health monitoring and recovery
    const totalActivity = previousState
      .flat()
      .reduce((sum, val) => sum + val, 0);
    const avgActivity = totalActivity / 16;

    if (avgActivity < 0.1) {
      previousState = injectRandomSeeds(previousState);
    } else if (avgActivity > 0.8) {
      previousState = applyCooling(previousState);
    }
  } else {
    // Fresh start with random initialization
    previousState = Array(gridSize)
      .fill()
      .map(() =>
        Array(gridSize)
          .fill(0)
          .map(() => Math.random() * 0.3),
      );
  }

  // Initialize cascades from previous cycle or create new ones
  let cascades = [...initialCascades].slice(0, maxCascades);

  // Phase-aware cascade parameters
  const cascadeStrengthVariation = phase.isSimplifying
    ? 0.6 + Math.random() * 0.3
    : 0.8 + Math.random() * 0.4;
  const cascadePropagationChance = propagationBase + Math.random() * 0.2;

  for (let frame = 0; frame < frameCount; frame++) {
    const newState = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Neural burst activation with evolution parameters
    const burstEvolution = 1 + Math.sin(frame * 0.3) * 0.2; // Oscillating activity

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let activeNeighbors = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
              if (previousState[ni][nj] > 0.5) activeNeighbors++;
            }
          }
        }

        // Phase-aware burst parameters
        const baseProb = phase.isSimplifying
          ? 0.05 + Math.random() * 0.03
          : 0.08 + Math.random() * 0.04;
        const neighborInfluence =
          activeNeighbors *
          (phase.isSimplifying
            ? 0.08 + Math.random() * 0.04
            : 0.12 + Math.random() * 0.06);
        const decayFactor =
          previousState[i][j] * (phase.isSimplifying ? 0.6 : 0.4);
        const evolutionBoost =
          burstEvolution * (phase.isComplexifying ? 0.08 : 0.03);
        const burstProb =
          baseProb + neighborInfluence - decayFactor + evolutionBoost;

        if (Math.random() < burstProb) {
          newState[i][j] = 0.6 + Math.random() * 0.4;

          // Phase-aware cascade triggering
          const cascadeTriggerChance = phase.isSimplifying
            ? 0.2 + Math.random() * 0.2
            : 0.4 + Math.random() * 0.2;
          if (newState[i][j] > 0.75 && Math.random() < cascadeTriggerChance) {
            cascades.push({
              x: j,
              y: i,
              age: 0,
              strength: newState[i][j] * cascadeStrengthVariation,
            });
          }
        } else if (previousState[i][j] > 0) {
          // Phase-aware decay
          const decayRange = phase.isSimplifying ? [0.3, 0.5] : [0.5, 0.7];
          newState[i][j] =
            previousState[i][j] *
            (decayRange[0] + Math.random() * (decayRange[1] - decayRange[0]));
        }
      }
    }

    // Process cascades with evolution
    const newCascades = [];
    cascades.forEach((cascade) => {
      if (cascade.age < 3) {
        const intensity = cascade.strength * (1 - cascade.age / 3);

        // Apply cascade to cell
        newState[cascade.y][cascade.x] = Math.max(
          newState[cascade.y][cascade.x],
          intensity,
        );

        spikes.push({
          x: cascade.x,
          y: cascade.y,
          intensity: intensity,
          type: "cascade",
          age: cascade.age,
        });

        // Evolved propagation
        if (cascade.age === 0) {
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              if (Math.abs(di) + Math.abs(dj) !== 1) continue; // Only orthogonal
              const ni = cascade.y + di;
              const nj = cascade.x + dj;
              if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                if (Math.random() < cascadePropagationChance) {
                  newCascades.push({
                    x: nj,
                    y: ni,
                    age: 0,
                    strength: cascade.strength * (0.7 + Math.random() * 0.2), // 0.7-0.9
                  });
                }
              }
            }
          }
        }

        cascade.age++;
        if (cascade.age < 3) {
          newCascades.push(cascade);
        }
      }
    });

    cascades = newCascades.slice(0, maxCascades); // Phase-aware cascade limit

    frames.push({
      cells: newState,
      spikes: spikes,
      connections: generateConnections(newState),
    });

    previousState = newState;
  }

  // Return evolved state for next cycle
  return {
    frames: frames,
    finalState: previousState,
    finalCascades: cascades,
  };
}

// Hybrid 2: Main Generator (Uses Continuous Version)
// Public interface that maintains evolving state
function generateHybrid2() {
  // For initial static compatibility, return just frames
  return generateContinuousHybrid2().frames;
}

// Hybrid 3: Emergent Wave Colonies
// Combines Pattern B's clusters with Pattern C's wave propagation
function generateHybrid3() {
  const frames = [];
  const gridSize = 4;
  let colonies = [];
  let waves = [];

  for (let frame = 0; frame < 12; frame++) {
    const state = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Update colonies (Pattern B style)
    if (frame % 4 === 0 || colonies.length === 0) {
      // Spawn new colony
      colonies.push({
        x: Math.random() * gridSize,
        y: Math.random() * gridSize,
        strength: 0.7 + Math.random() * 0.3,
        radius: 1 + Math.random(),
        age: 0,
      });
    }

    // Process colonies
    const newColonies = [];
    colonies.forEach((colony) => {
      // Apply colony influence
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const dist = Math.sqrt(
            Math.pow(i - colony.y, 2) + Math.pow(j - colony.x, 2),
          );
          if (dist <= colony.radius) {
            const influence = colony.strength * (1 - dist / colony.radius);
            state[i][j] = Math.max(state[i][j], influence);
          }
        }
      }

      // Emit wave from colony center periodically
      if (colony.age % 3 === 0 && colony.strength > 0.5) {
        waves.push({
          x: Math.floor(colony.x),
          y: Math.floor(colony.y),
          radius: 0,
          strength: colony.strength,
        });
      }

      // Age and potentially merge/split colonies
      colony.age++;
      colony.strength *= 0.95;

      if (colony.strength > 0.3) {
        // Colony drift
        colony.x += (Math.random() - 0.5) * 0.3;
        colony.y += (Math.random() - 0.5) * 0.3;
        colony.x = Math.max(0, Math.min(gridSize, colony.x));
        colony.y = Math.max(0, Math.min(gridSize, colony.y));

        newColonies.push(colony);

        // Chance to split
        if (colony.strength > 0.7 && Math.random() < 0.2) {
          newColonies.push({
            x: colony.x + (Math.random() - 0.5) * 2,
            y: colony.y + (Math.random() - 0.5) * 2,
            strength: colony.strength * 0.5,
            radius: colony.radius * 0.8,
            age: 0,
          });
          colony.strength *= 0.5;
        }
      }
    });
    colonies = newColonies.slice(0, 4); // Limit colony count

    // Process waves (Pattern C style)
    const newWaves = [];
    waves.forEach((wave) => {
      wave.radius += 0.5;
      wave.strength *= 0.8;

      if (wave.strength > 0.2 && wave.radius < 3) {
        // Apply wave influence
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const dist = Math.sqrt(
              Math.pow(i - wave.y, 2) + Math.pow(j - wave.x, 2),
            );
            if (Math.abs(dist - wave.radius) < 0.5) {
              state[i][j] = Math.max(state[i][j], wave.strength);

              // Wave can spawn new colony
              if (wave.strength > 0.5 && Math.random() < 0.1) {
                colonies.push({
                  x: j,
                  y: i,
                  strength: wave.strength * 0.7,
                  radius: 0.8,
                  age: 0,
                });
              }
            }
          }
        }
        newWaves.push(wave);
      }
    });
    waves = newWaves;

    // Generate spikes for active cells
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (state[i][j] > 0.5) {
          spikes.push({
            x: j,
            y: i,
            intensity: state[i][j],
            type: state[i][j] > 0.8 ? "cascade" : "pulse",
          });
        }
      }
    }

    frames.push({
      cells: state,
      spikes: spikes,
      connections: generateConnections(state),
    });
  }

  return frames;
}

// Hybrid 4: Synaptic Storm
// All three patterns working in phases - clusters, cascades, then bursts
function generateHybrid4() {
  const frames = [];
  const gridSize = 4;
  let previousState = Array(gridSize)
    .fill()
    .map(() => Array(gridSize).fill(0));

  // Phase management
  const phaseDuration = 4;
  const phases = ["cluster", "cascade", "burst"];

  // Pattern-specific state
  let clusters = [];
  let cascades = [];

  for (let frame = 0; frame < 12; frame++) {
    const currentPhase =
      phases[Math.floor(frame / phaseDuration) % phases.length];
    const phaseProgress = (frame % phaseDuration) / phaseDuration;

    const newState = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Apply decay from previous state
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        newState[i][j] = previousState[i][j] * 0.7;
      }
    }

    // Execute current phase
    switch (currentPhase) {
      case "cluster":
        // Pattern B: Cluster formation
        if (phaseProgress === 0) {
          clusters = [];
          const numClusters = 2 + Math.floor(Math.random() * 2);
          for (let c = 0; c < numClusters; c++) {
            clusters.push({
              x: Math.random() * gridSize,
              y: Math.random() * gridSize,
              strength: 0.7 + Math.random() * 0.3,
              radius: 1.5 + Math.random() * 0.5,
            });
          }
        }

        clusters.forEach((cluster) => {
          for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
              const dist = Math.sqrt(
                Math.pow(i - cluster.y, 2) + Math.pow(j - cluster.x, 2),
              );
              if (dist <= cluster.radius) {
                const influence =
                  cluster.strength *
                  (1 - dist / cluster.radius) *
                  (1 - phaseProgress * 0.5);
                newState[i][j] = Math.max(newState[i][j], influence);

                if (influence > 0.6) {
                  spikes.push({
                    x: j,
                    y: i,
                    intensity: influence,
                    type: "pulse",
                  });
                }
              }
            }
          }
        });
        break;

      case "cascade":
        // Pattern C: Cascade propagation
        if (phaseProgress === 0) {
          cascades = [];
          // Use high activity areas from previous phase as cascade starts
          for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
              if (previousState[i][j] > 0.6 && Math.random() < 0.5) {
                cascades.push({
                  x: j,
                  y: i,
                  age: 0,
                  strength: previousState[i][j],
                });
              }
            }
          }
        }

        const newCascades = [];
        cascades.forEach((cascade) => {
          if (cascade.age < 3) {
            const intensity = cascade.strength * (1 - cascade.age / 3);
            newState[cascade.y][cascade.x] = Math.max(
              newState[cascade.y][cascade.x],
              intensity,
            );

            spikes.push({
              x: cascade.x,
              y: cascade.y,
              intensity: intensity,
              type: "cascade",
              age: cascade.age,
            });

            if (cascade.age === 0) {
              for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                  if (Math.abs(di) + Math.abs(dj) !== 1) continue;
                  const ni = cascade.y + di;
                  const nj = cascade.x + dj;
                  if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                    if (Math.random() < 0.7) {
                      newCascades.push({
                        x: nj,
                        y: ni,
                        age: 0,
                        strength: cascade.strength * 0.8,
                      });
                    }
                  }
                }
              }
            }
            cascade.age++;
            if (cascade.age < 3) newCascades.push(cascade);
          }
        });
        cascades = newCascades;
        break;

      case "burst":
        // Pattern A: Neural bursts
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            let activeNeighbors = 0;
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                const ni = i + di;
                const nj = j + dj;
                if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                  if (previousState[ni][nj] > 0.4) activeNeighbors++;
                }
              }
            }

            const baseProb = 0.15;
            const neighborInfluence = activeNeighbors * 0.2;
            const phaseBoost = (1 - phaseProgress) * 0.2; // Stronger at phase start
            const activationProb = baseProb + neighborInfluence + phaseBoost;

            if (Math.random() < activationProb) {
              newState[i][j] = Math.max(
                newState[i][j],
                0.7 + Math.random() * 0.3,
              );

              if (newState[i][j] > 0.8) {
                spikes.push({
                  x: j,
                  y: i,
                  intensity: newState[i][j],
                  type: "star",
                });
              }
            }
          }
        }
        break;
    }

    frames.push({
      cells: newState,
      spikes: spikes,
      connections: generateConnections(newState),
    });

    previousState = newState;
  }

  return frames;
}

// Hybrid 5: Quantum Consciousness Grid
// Probabilistic mixing of all three behaviors with quantum-like entanglement
function generateHybrid5() {
  const frames = [];
  const gridSize = 4;

  // Quantum state for each cell (superposition of patterns)
  let quantumState = Array(gridSize)
    .fill()
    .map(() =>
      Array(gridSize)
        .fill()
        .map(() => ({
          burst: Math.random() * 0.3,
          cluster: Math.random() * 0.3,
          cascade: Math.random() * 0.3,
          entangled: [],
        })),
    );

  // Track global pattern coherence
  let coherence = 0.5;

  for (let frame = 0; frame < 12; frame++) {
    const newState = Array(gridSize)
      .fill()
      .map(() => Array(gridSize).fill(0));
    const spikes = [];

    // Update quantum coherence (oscillates)
    coherence = 0.5 + 0.4 * Math.sin((frame * Math.PI) / 6);

    // Process each cell's quantum state
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const qCell = quantumState[i][j];

        // Collapse quantum state based on coherence
        const collapseProb = Math.random();
        let dominantPattern = "";
        let maxAmplitude = 0;

        // Find dominant pattern
        if (qCell.burst > maxAmplitude) {
          maxAmplitude = qCell.burst;
          dominantPattern = "burst";
        }
        if (qCell.cluster > maxAmplitude) {
          maxAmplitude = qCell.cluster;
          dominantPattern = "cluster";
        }
        if (qCell.cascade > maxAmplitude) {
          maxAmplitude = qCell.cascade;
          dominantPattern = "cascade";
        }

        // Apply pattern behavior based on collapse
        let activation = 0;

        if (collapseProb < coherence) {
          // Coherent state - clear pattern behavior
          switch (dominantPattern) {
            case "burst":
              // Count active neighbors
              let activeNeighbors = 0;
              for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                  if (di === 0 && dj === 0) continue;
                  const ni = i + di;
                  const nj = j + dj;
                  if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                    const neighborTotal =
                      quantumState[ni][nj].burst +
                      quantumState[ni][nj].cluster +
                      quantumState[ni][nj].cascade;
                    if (neighborTotal > 0.5) activeNeighbors++;
                  }
                }
              }
              activation = qCell.burst * (1 + activeNeighbors * 0.2);
              break;

            case "cluster":
              // Influence from nearby high-amplitude cells
              let clusterInfluence = qCell.cluster;
              for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                  if (di === 0 && dj === 0) continue;
                  const ni = i + di;
                  const nj = j + dj;
                  if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                    clusterInfluence += quantumState[ni][nj].cluster * 0.3;
                  }
                }
              }
              activation = Math.min(1, clusterInfluence);
              break;

            case "cascade":
              // Wave-like propagation
              activation =
                qCell.cascade * (1 + Math.sin(frame * 0.5 + i + j) * 0.3);
              break;
          }
        } else {
          // Decoherent state - mixed behavior (flickering)
          activation = (qCell.burst + qCell.cluster + qCell.cascade) / 3;
          activation *= 0.5 + Math.random() * 0.5; // Flickering
        }

        newState[i][j] = Math.min(1, activation);

        // Generate spikes based on activation and pattern
        if (activation > 0.5) {
          let spikeType = "star";
          if (dominantPattern === "cluster") spikeType = "pulse";
          if (dominantPattern === "cascade") spikeType = "cascade";

          // Quantum flickering for high coherence
          if (coherence > 0.7 && Math.random() < 0.3) {
            spikeType = "quantum";
          }

          spikes.push({
            x: j,
            y: i,
            intensity: activation,
            type: spikeType,
            flickering: coherence < 0.3,
          });
        }

        // Update quantum state (evolution)
        qCell.burst *= 0.9;
        qCell.cluster *= 0.9;
        qCell.cascade *= 0.9;

        // Quantum tunneling - random amplitude jumps
        if (Math.random() < 0.2) {
          const patterns = ["burst", "cluster", "cascade"];
          const chosenPattern =
            patterns[Math.floor(Math.random() * patterns.length)];
          qCell[chosenPattern] = Math.min(
            1,
            qCell[chosenPattern] + Math.random() * 0.5,
          );
        }

        // Entanglement effects
        if (activation > 0.7 && Math.random() < 0.3) {
          // Entangle with a random cell
          const ex = Math.floor(Math.random() * gridSize);
          const ey = Math.floor(Math.random() * gridSize);
          if (ex !== j || ey !== i) {
            // Transfer amplitude
            quantumState[ey][ex].burst += qCell.burst * 0.2;
            quantumState[ey][ex].cluster += qCell.cluster * 0.2;
            quantumState[ey][ex].cascade += qCell.cascade * 0.2;
          }
        }
      }
    }

    frames.push({
      cells: newState,
      spikes: spikes,
      connections: generateConnections(newState),
    });
  }

  return frames;
}

// Export all hybrid patterns
if (typeof window !== "undefined") {
  window.generateHybrid1 = generateHybrid1;
  window.generateHybrid2 = generateHybrid2;
  window.generateStaticHybrid2 = generateStaticHybrid2;
  window.generateContinuousHybrid2 = generateContinuousHybrid2;
  window.generateHybrid3 = generateHybrid3;
  window.generateHybrid4 = generateHybrid4;
  window.generateHybrid5 = generateHybrid5;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateHybrid1,
    generateHybrid2,
    generateStaticHybrid2,
    generateContinuousHybrid2,
    generateHybrid3,
    generateHybrid4,
    generateHybrid5,
  };
}
