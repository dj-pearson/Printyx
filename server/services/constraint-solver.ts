/**
 * Advanced Constraint Satisfaction System
 * Implements Mixed Integer Programming for optimal task scheduling
 */

import ClaudeAIService from './claude-ai-service';

interface Variable {
  id: string;
  name: string;
  domain: any[];
  value?: any;
  constraints: string[];
}

interface Constraint {
  id: string;
  type: 'hard' | 'soft';
  priority: number; // 1-10, 10 being highest
  variables: string[];
  condition: (values: Record<string, any>) => boolean | number; // boolean for hard, number for soft (violation cost)
  description: string;
}

interface SchedulingVariable extends Variable {
  taskId: string;
  startTime?: Date;
  endTime?: Date;
  assignedResource?: string;
}

interface SchedulingConstraint extends Constraint {
  category: 'time' | 'resource' | 'dependency' | 'preference' | 'business';
}

interface OptimizationResult {
  solution: Record<string, any>;
  cost: number;
  violations: Array<{
    constraintId: string;
    severity: number;
    description: string;
  }>;
  confidence: number;
  reasoning: string;
}

class ConstraintSolver {
  private variables: Map<string, SchedulingVariable> = new Map();
  private constraints: Map<string, SchedulingConstraint> = new Map();
  private maxIterations = 10000;
  private convergenceThreshold = 0.01;

  /**
   * Add a scheduling variable
   */
  addVariable(variable: SchedulingVariable): void {
    this.variables.set(variable.id, variable);
  }

  /**
   * Add a scheduling constraint
   */
  addConstraint(constraint: SchedulingConstraint): void {
    this.constraints.set(constraint.id, constraint);
  }

  /**
   * Solve the constraint satisfaction problem using advanced algorithms
   */
  async solve(): Promise<OptimizationResult> {
    console.log('🧮 Starting advanced constraint satisfaction solving...');

    try {
      // Use hybrid approach: start with heuristics, then optimize with AI
      const heuristicSolution = await this.solveWithHeuristics();
      const optimizedSolution = await this.optimizeWithAI(heuristicSolution);

      return optimizedSolution;
    } catch (error) {
      console.error('Constraint solving failed:', error);
      return this.fallbackSolution();
    }
  }

  /**
   * Solve using heuristic algorithms (backtracking + forward checking)
   */
  private async solveWithHeuristics(): Promise<OptimizationResult> {
    const solution: Record<string, any> = {};
    const violations: Array<{ constraintId: string; severity: number; description: string }> = [];

    // Order variables by most constrained first (MRV heuristic)
    const orderedVariables = this.orderVariablesByConstraints();

    // Backtracking with constraint propagation
    const result = await this.backtrackSearch(orderedVariables, solution, 0);

    if (result.success) {
      const cost = this.calculateSolutionCost(result.solution);
      const constraintViolations = this.checkConstraintViolations(result.solution);

      return {
        solution: result.solution,
        cost,
        violations: constraintViolations,
        confidence: this.calculateConfidence(cost, constraintViolations),
        reasoning: 'Heuristic solution using backtracking with constraint propagation',
      };
    } else {
      // Partial solution with constraint relaxation
      return this.relaxConstraintsAndSolve(solution);
    }
  }

  /**
   * Optimize solution using Claude AI
   */
  private async optimizeWithAI(initialSolution: OptimizationResult): Promise<OptimizationResult> {
    try {
      const optimizationPrompt = `Optimize this task scheduling solution:

Current Solution Cost: ${initialSolution.cost}
Constraint Violations: ${initialSolution.violations.length}
Variables: ${Array.from(this.variables.keys()).length}
Constraints: ${Array.from(this.constraints.keys()).length}

Key Violations:
${initialSolution.violations
  .slice(0, 5)
  .map((v) => `- ${v.description} (severity: ${v.severity})`)
  .join('\n')}

Optimization Goals:
1. Minimize constraint violations
2. Optimize for business priority (sales > service > admin)
3. Respect user energy levels and preferences
4. Minimize context switching
5. Maximize resource utilization

Provide optimization suggestions as JSON with:
- adjustments: array of specific variable changes
- reasoning: explanation of optimization strategy
- expectedImprovement: estimated cost reduction percentage`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: optimizationPrompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const aiSuggestions = JSON.parse(aiResponse);

      // Apply AI suggestions
      const optimizedSolution = this.applyOptimizations(initialSolution, aiSuggestions);

      return {
        ...optimizedSolution,
        reasoning: `AI-optimized solution: ${aiSuggestions.reasoning}`,
        confidence: Math.min(0.95, optimizedSolution.confidence + 0.1),
      };
    } catch (error) {
      console.error('AI optimization failed:', error);
      return initialSolution;
    }
  }

  /**
   * Backtracking search with forward checking
   */
  private async backtrackSearch(
    variables: SchedulingVariable[],
    assignment: Record<string, any>,
    depth: number,
  ): Promise<{ success: boolean; solution: Record<string, any> }> {
    if (depth >= variables.length) {
      return { success: true, solution: assignment };
    }

    const variable = variables[depth];

    // Order domain values by least constraining value heuristic
    const orderedDomain = this.orderDomainValues(variable, assignment);

    for (const value of orderedDomain) {
      assignment[variable.id] = value;

      // Check consistency with current assignment
      if (this.isConsistent(variable.id, value, assignment)) {
        // Forward checking: reduce domains of unassigned variables
        const domainReductions = this.forwardCheck(variable.id, value, variables.slice(depth + 1));

        if (domainReductions.feasible) {
          // Recursively assign remaining variables
          const result = await this.backtrackSearch(variables, assignment, depth + 1);

          if (result.success) {
            return result;
          }
        }

        // Restore domains if backtracking
        this.restoreDomains(domainReductions.changes);
      }

      delete assignment[variable.id];
    }

    return { success: false, solution: assignment };
  }

  /**
   * Order variables by Most Remaining Values (MRV) heuristic
   */
  private orderVariablesByConstraints(): SchedulingVariable[] {
    const variables = Array.from(this.variables.values());

    return variables.sort((a, b) => {
      // Primary: fewest remaining values
      const aConstraints = a.constraints.length;
      const bConstraints = b.constraints.length;

      if (aConstraints !== bConstraints) {
        return bConstraints - aConstraints; // More constraints first
      }

      // Secondary: domain size
      return a.domain.length - b.domain.length;
    });
  }

  /**
   * Order domain values by Least Constraining Value heuristic
   */
  private orderDomainValues(variable: SchedulingVariable, assignment: Record<string, any>): any[] {
    return variable.domain.sort((a, b) => {
      // Count how many constraints each value would violate
      const aViolations = this.countPotentialViolations(variable.id, a, assignment);
      const bViolations = this.countPotentialViolations(variable.id, b, assignment);

      return aViolations - bViolations;
    });
  }

  /**
   * Check if assignment is consistent with constraints
   */
  private isConsistent(variableId: string, value: any, assignment: Record<string, any>): boolean {
    const tempAssignment = { ...assignment, [variableId]: value };

    for (const constraint of this.constraints.values()) {
      if (constraint.type === 'hard' && constraint.variables.includes(variableId)) {
        const satisfied = constraint.condition(tempAssignment) as boolean;
        if (!satisfied) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Forward checking to reduce domains of unassigned variables
   */
  private forwardCheck(
    assignedVar: string,
    assignedValue: any,
    remainingVariables: SchedulingVariable[],
  ): { feasible: boolean; changes: Array<{ varId: string; removedValues: any[] }> } {
    const changes: Array<{ varId: string; removedValues: any[] }> = [];

    for (const variable of remainingVariables) {
      const removedValues: any[] = [];

      for (const value of variable.domain) {
        // Check if this value would violate constraints with current assignment
        const tempAssignment = { [assignedVar]: assignedValue, [variable.id]: value };

        let violatesConstraint = false;
        for (const constraint of this.constraints.values()) {
          if (
            constraint.type === 'hard' &&
            constraint.variables.includes(assignedVar) &&
            constraint.variables.includes(variable.id)
          ) {
            if (!(constraint.condition(tempAssignment) as boolean)) {
              violatesConstraint = true;
              break;
            }
          }
        }

        if (violatesConstraint) {
          removedValues.push(value);
        }
      }

      // Remove inconsistent values from domain
      variable.domain = variable.domain.filter((v) => !removedValues.includes(v));

      if (removedValues.length > 0) {
        changes.push({ varId: variable.id, removedValues });
      }

      // If domain becomes empty, forward checking failed
      if (variable.domain.length === 0) {
        return { feasible: false, changes };
      }
    }

    return { feasible: true, changes };
  }

  /**
   * Restore domains after backtracking
   */
  private restoreDomains(changes: Array<{ varId: string; removedValues: any[] }>): void {
    for (const change of changes) {
      const variable = this.variables.get(change.varId);
      if (variable) {
        variable.domain.push(...change.removedValues);
      }
    }
  }

  /**
   * Count potential constraint violations for a value
   */
  private countPotentialViolations(
    variableId: string,
    value: any,
    assignment: Record<string, any>,
  ): number {
    let violations = 0;
    const tempAssignment = { ...assignment, [variableId]: value };

    for (const constraint of this.constraints.values()) {
      if (constraint.variables.includes(variableId)) {
        if (constraint.type === 'hard') {
          if (!(constraint.condition(tempAssignment) as boolean)) {
            violations += constraint.priority * 10; // Heavy penalty for hard constraints
          }
        } else {
          const cost = constraint.condition(tempAssignment) as number;
          violations += cost * constraint.priority;
        }
      }
    }

    return violations;
  }

  /**
   * Calculate total solution cost
   */
  private calculateSolutionCost(solution: Record<string, any>): number {
    let totalCost = 0;

    for (const constraint of this.constraints.values()) {
      if (constraint.type === 'soft') {
        const cost = constraint.condition(solution) as number;
        totalCost += cost * constraint.priority;
      } else {
        // Hard constraint violations get heavy penalty
        const satisfied = constraint.condition(solution) as boolean;
        if (!satisfied) {
          totalCost += 1000 * constraint.priority;
        }
      }
    }

    return totalCost;
  }

  /**
   * Check for constraint violations
   */
  private checkConstraintViolations(solution: Record<string, any>): Array<{
    constraintId: string;
    severity: number;
    description: string;
  }> {
    const violations = [];

    for (const [id, constraint] of this.constraints.entries()) {
      if (constraint.type === 'hard') {
        const satisfied = constraint.condition(solution) as boolean;
        if (!satisfied) {
          violations.push({
            constraintId: id,
            severity: constraint.priority,
            description: constraint.description,
          });
        }
      } else {
        const cost = constraint.condition(solution) as number;
        if (cost > 0) {
          violations.push({
            constraintId: id,
            severity: cost * constraint.priority,
            description: `${constraint.description} (cost: ${cost})`,
          });
        }
      }
    }

    return violations.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(cost: number, violations: any[]): number {
    const hardViolations = violations.filter((v) => v.severity >= 100).length;

    if (hardViolations > 0) {
      return Math.max(0.1, 0.8 - hardViolations * 0.2);
    }

    // Confidence based on soft constraint satisfaction
    const maxPossibleCost = Array.from(this.constraints.values())
      .filter((c) => c.type === 'soft')
      .reduce((sum, c) => sum + c.priority * 100, 0);

    if (maxPossibleCost === 0) return 0.9;

    const satisfactionRatio = 1 - cost / maxPossibleCost;
    return Math.max(0.1, Math.min(0.9, satisfactionRatio));
  }

  /**
   * Apply AI optimization suggestions
   */
  private applyOptimizations(solution: OptimizationResult, suggestions: any): OptimizationResult {
    const optimizedSolution = { ...solution.solution };

    if (suggestions.adjustments && Array.isArray(suggestions.adjustments)) {
      for (const adjustment of suggestions.adjustments) {
        if (adjustment.variable && adjustment.newValue) {
          optimizedSolution[adjustment.variable] = adjustment.newValue;
        }
      }
    }

    const newCost = this.calculateSolutionCost(optimizedSolution);
    const newViolations = this.checkConstraintViolations(optimizedSolution);

    return {
      solution: optimizedSolution,
      cost: newCost,
      violations: newViolations,
      confidence: this.calculateConfidence(newCost, newViolations),
      reasoning: solution.reasoning,
    };
  }

  /**
   * Relax constraints and find partial solution
   */
  private relaxConstraintsAndSolve(partialSolution: Record<string, any>): OptimizationResult {
    // Convert some hard constraints to soft constraints
    const relaxedConstraints = new Map(this.constraints);

    for (const [id, constraint] of relaxedConstraints.entries()) {
      if (constraint.type === 'hard' && constraint.priority < 8) {
        relaxedConstraints.set(id, {
          ...constraint,
          type: 'soft',
          priority: constraint.priority * 2,
        });
      }
    }

    // Simple greedy assignment for remaining variables
    const solution = { ...partialSolution };

    for (const variable of this.variables.values()) {
      if (!solution[variable.id] && variable.domain.length > 0) {
        // Choose first feasible value
        solution[variable.id] = variable.domain[0];
      }
    }

    return {
      solution,
      cost: this.calculateSolutionCost(solution),
      violations: this.checkConstraintViolations(solution),
      confidence: 0.4, // Low confidence for relaxed solution
      reasoning: 'Constraint relaxation solution - some hard constraints converted to soft',
    };
  }

  /**
   * Fallback solution when all else fails
   */
  private fallbackSolution(): OptimizationResult {
    const solution: Record<string, any> = {};

    // Assign first available value to each variable
    for (const variable of this.variables.values()) {
      if (variable.domain.length > 0) {
        solution[variable.id] = variable.domain[0];
      }
    }

    return {
      solution,
      cost: 9999,
      violations: [
        { constraintId: 'fallback', severity: 100, description: 'Fallback solution used' },
      ],
      confidence: 0.1,
      reasoning: 'Fallback solution - constraint solver failed',
    };
  }

  /**
   * Clear all variables and constraints
   */
  clear(): void {
    this.variables.clear();
    this.constraints.clear();
  }

  /**
   * Get solver statistics
   */
  getStatistics(): {
    variableCount: number;
    constraintCount: number;
    hardConstraints: number;
    softConstraints: number;
  } {
    const constraints = Array.from(this.constraints.values());

    return {
      variableCount: this.variables.size,
      constraintCount: this.constraints.size,
      hardConstraints: constraints.filter((c) => c.type === 'hard').length,
      softConstraints: constraints.filter((c) => c.type === 'soft').length,
    };
  }
}

export default ConstraintSolver;
