import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';

const execAsync = promisify(exec);

interface DocumentationManifest {
  version: string;
  mappings: {
    section_id: string;
    section_name: string;
    triggers: Array<{
      type: 'file' | 'schema' | 'integration';
      path?: string;
      table?: string;
      provider?: string;
      watch_for?: string[];
    }>;
    auto_updatable_fields: string[];
    human_curated_fields: string[];
  }[];
}

interface DocumentationContent {
  version: string;
  last_updated: string;
  sections: Record<string, any>;
  metadata: {
    auto_update_history: Array<{
      timestamp: string;
      section_id: string;
      changes: string[];
      approved: boolean;
    }>;
    manual_overrides: Record<string, any>;
  };
}

interface ChangeDetectionResult {
  affectedSections: Array<{
    section_id: string;
    section_name: string;
    changes: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;
  filesChanged: string[];
  summary: string;
  detailedDiff: string;  // Include detailed diff for AI analysis
}

interface AIUpdateSuggestion {
  section_id: string;
  field: string;
  current_value: any;
  suggested_value: any;
  reasoning: string;
  confidence: number;
}

export class DocumentationSyncService {
  private manifestPath: string;
  private contentPath: string;
  private openai: OpenAI;

  constructor() {
    this.manifestPath = join(process.cwd(), 'docs', 'documentation-manifest.json');
    this.contentPath = join(process.cwd(), 'docs', 'documentation-content.json');
    
    // Initialize OpenAI with existing API key
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Sanitize git reference to prevent command injection
   */
  private sanitizeGitRef(ref: string): string {
    // Only allow alphanumeric, hyphens, underscores, dots, slashes, tildes, and carets
    // These are valid git reference characters
    const sanitized = ref.replace(/[^a-zA-Z0-9\-_./~^]/g, '');
    
    // Validate it matches common git reference patterns
    const validPatterns = [
      /^HEAD(~\d+)?$/,           // HEAD, HEAD~1, HEAD~2, etc.
      /^[a-f0-9]{7,40}$/,        // Git commit SHA (7-40 chars)
      /^[\w\-./]+$/,             // Branch names, tags
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(sanitized));
    
    if (!isValid || sanitized.length === 0) {
      throw new Error(`Invalid git reference: ${ref}`);
    }
    
    return sanitized;
  }

  /**
   * Detect changes from git diff
   */
  async detectChanges(baseBranch: string = 'HEAD~1'): Promise<ChangeDetectionResult> {
    try {
      // Sanitize the base branch to prevent command injection
      const safeBaseBranch = this.sanitizeGitRef(baseBranch);
      
      // Get git diff
      const { stdout: diffOutput } = await execAsync(`git diff ${safeBaseBranch} --name-only`);
      const filesChanged = diffOutput.trim().split('\n').filter(f => f.length > 0);

      if (filesChanged.length === 0) {
        return {
          affectedSections: [],
          filesChanged: [],
          summary: 'No changes detected',
          detailedDiff: ''
        };
      }

      // Get detailed diff for analysis
      const { stdout: detailedDiff } = await execAsync(`git diff ${safeBaseBranch}`);

      // Load manifest
      const manifest = await this.loadManifest();

      // Analyze which sections are affected
      const affectedSections = await this.analyzeAffectedSections(filesChanged, detailedDiff, manifest);

      return {
        affectedSections,
        filesChanged,
        summary: `${filesChanged.length} files changed, ${affectedSections.length} documentation sections affected`,
        detailedDiff
      };

    } catch (error) {
      console.error('Error detecting changes:', error);
      throw new Error(`Change detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze which documentation sections are affected by file changes
   */
  private async analyzeAffectedSections(
    filesChanged: string[],
    detailedDiff: string,
    manifest: DocumentationManifest
  ): Promise<ChangeDetectionResult['affectedSections']> {
    const affected: ChangeDetectionResult['affectedSections'] = [];

    for (const mapping of manifest.mappings) {
      const changes: string[] = [];
      let matchFound = false;

      for (const trigger of mapping.triggers) {
        if (trigger.type === 'file' && trigger.path) {
          // Check if this file was changed
          const fileMatch = filesChanged.some(f => f.includes(trigger.path!));
          
          if (fileMatch && trigger.watch_for) {
            // Check if any watched keywords appear in the diff
            const keywordMatches = trigger.watch_for.filter(keyword => 
              detailedDiff.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (keywordMatches.length > 0) {
              matchFound = true;
              changes.push(`Changes detected in ${trigger.path}: ${keywordMatches.join(', ')}`);
            }
          }
        } else if (trigger.type === 'schema' && trigger.table) {
          // Check if schema file was changed and contains this table
          const schemaChanged = filesChanged.some(f => f.includes('schema.ts'));
          if (schemaChanged && detailedDiff.includes(trigger.table)) {
            matchFound = true;
            changes.push(`Schema changes detected for table: ${trigger.table}`);
          }
        }
      }

      if (matchFound) {
        affected.push({
          section_id: mapping.section_id,
          section_name: mapping.section_name,
          changes,
          confidence: changes.length > 2 ? 'high' : changes.length > 1 ? 'medium' : 'low'
        });
      }
    }

    return affected;
  }

  /**
   * Generate AI-powered documentation updates
   */
  async generateAIUpdates(
    affectedSections: ChangeDetectionResult['affectedSections'],
    detailedDiff: string
  ): Promise<AIUpdateSuggestion[]> {
    const suggestions: AIUpdateSuggestion[] = [];
    const manifest = await this.loadManifest();
    const content = await this.loadContent();

    for (const section of affectedSections) {
      const mapping = manifest.mappings.find(m => m.section_id === section.section_id);
      if (!mapping) continue;

      const sectionContent = content.sections[section.section_id];
      if (!sectionContent) continue;

      // Generate AI suggestions for auto-updatable fields
      for (const field of mapping.auto_updatable_fields) {
        const currentValue = sectionContent.auto_updatable?.[field];
        
        const prompt = `You are a technical documentation expert. Analyze the following code changes and suggest updates to the documentation.

Documentation Section: ${section.section_name}
Field to Update: ${field}
Current Documentation:
${JSON.stringify(currentValue, null, 2)}

Code Changes Detected:
${section.changes.join('\n')}

Relevant Git Diff:
${this.extractRelevantDiff(detailedDiff, section.changes)}

Task: Based on these code changes, suggest an updated value for the "${field}" field. 
- Maintain the same data structure as the current value
- Be precise and technical
- Focus only on what actually changed
- If no update is needed, respond with "NO_UPDATE_NEEDED"

Respond in JSON format:
{
  "update_needed": true/false,
  "suggested_value": <updated value matching current structure>,
  "reasoning": "Brief explanation of why this update is needed",
  "confidence": 0.0-1.0
}`;

        try {
          const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          });

          const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
          
          if (aiResponse.update_needed && aiResponse.suggested_value) {
            suggestions.push({
              section_id: section.section_id,
              field,
              current_value: currentValue,
              suggested_value: aiResponse.suggested_value,
              reasoning: aiResponse.reasoning,
              confidence: aiResponse.confidence || 0.5
            });
          }
        } catch (error) {
          console.error(`Error generating AI update for ${section.section_id}.${field}:`, error);
        }
      }
    }

    return suggestions;
  }

  /**
   * Extract relevant portions of diff for AI analysis
   */
  private extractRelevantDiff(fullDiff: string, changes: string[]): string {
    const lines = fullDiff.split('\n');
    const relevantLines: string[] = [];
    
    // Extract context around each change
    for (const change of changes) {
      const keywords = change.split(':')[1]?.trim().split(', ') || [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (keywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) {
          // Include 3 lines before and after for context
          const start = Math.max(0, i - 3);
          const end = Math.min(lines.length, i + 4);
          relevantLines.push(...lines.slice(start, end));
        }
      }
    }
    
    return relevantLines.join('\n').substring(0, 2000); // Limit size
  }

  /**
   * Apply approved updates to documentation
   */
  async applyUpdates(approvedSuggestions: AIUpdateSuggestion[]): Promise<void> {
    const content = await this.loadContent();

    for (const suggestion of approvedSuggestions) {
      if (!content.sections[suggestion.section_id]) {
        console.warn(`Section ${suggestion.section_id} not found in content`);
        continue;
      }

      // Update the auto_updatable field
      if (!content.sections[suggestion.section_id].auto_updatable) {
        content.sections[suggestion.section_id].auto_updatable = {};
      }
      
      content.sections[suggestion.section_id].auto_updatable[suggestion.field] = suggestion.suggested_value;

      // Log the update in history
      content.metadata.auto_update_history.push({
        timestamp: new Date().toISOString(),
        section_id: suggestion.section_id,
        changes: [`Updated ${suggestion.field}: ${suggestion.reasoning}`],
        approved: true
      });
    }

    // Update last_updated timestamp
    content.last_updated = new Date().toISOString();

    // Save updated content
    await this.saveContent(content);
  }

  /**
   * Get pending documentation updates
   */
  async getPendingUpdates(): Promise<AIUpdateSuggestion[]> {
    // This would typically query a database table for pending updates
    // For now, we'll return empty array - updates are generated on-demand
    return [];
  }

  /**
   * Load documentation manifest
   */
  private async loadManifest(): Promise<DocumentationManifest> {
    const content = await readFile(this.manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Load documentation content
   */
  private async loadContent(): Promise<DocumentationContent> {
    const content = await readFile(this.contentPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save documentation content
   */
  private async saveContent(content: DocumentationContent): Promise<void> {
    await writeFile(this.contentPath, JSON.stringify(content, null, 2), 'utf-8');
  }

  /**
   * Get current documentation content (for API endpoint)
   */
  async getDocumentationContent(): Promise<DocumentationContent> {
    return this.loadContent();
  }
}

// Export singleton instance
export const documentationSyncService = new DocumentationSyncService();
