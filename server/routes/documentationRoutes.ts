import { Router, type Request, type Response } from 'express';
import { documentationSyncService } from '../services/documentationSyncService';

const router = Router();

/**
 * GET /api/documentation/content
 * Get current documentation content
 */
router.get('/content', async (req: Request, res: Response) => {
  try {
    const content = await documentationSyncService.getDocumentationContent();
    res.json(content);
  } catch (error) {
    console.error('Error fetching documentation content:', error);
    res.status(500).json({ 
      error: 'Failed to fetch documentation content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documentation/detect-changes
 * Detect documentation changes from git diff
 */
router.post('/detect-changes', async (req: Request, res: Response) => {
  try {
    const { baseBranch = 'HEAD~1' } = req.body;
    const changes = await documentationSyncService.detectChanges(baseBranch);
    res.json(changes);
  } catch (error) {
    console.error('Error detecting changes:', error);
    res.status(500).json({ 
      error: 'Failed to detect changes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documentation/generate-updates
 * Generate AI-powered documentation updates based on detected changes
 */
router.post('/generate-updates', async (req: Request, res: Response) => {
  try {
    const { affectedSections, detailedDiff } = req.body;
    
    if (!affectedSections || !detailedDiff) {
      return res.status(400).json({ 
        error: 'Missing required fields: affectedSections and detailedDiff' 
      });
    }

    const suggestions = await documentationSyncService.generateAIUpdates(
      affectedSections,
      detailedDiff
    );
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating updates:', error);
    res.status(500).json({ 
      error: 'Failed to generate updates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documentation/apply-updates
 * Apply approved documentation updates
 */
router.post('/apply-updates', async (req: Request, res: Response) => {
  try {
    const { approvedSuggestions } = req.body;
    
    if (!Array.isArray(approvedSuggestions)) {
      return res.status(400).json({ 
        error: 'approvedSuggestions must be an array' 
      });
    }

    await documentationSyncService.applyUpdates(approvedSuggestions);
    
    res.json({ 
      success: true, 
      message: `${approvedSuggestions.length} updates applied successfully`,
      updatesApplied: approvedSuggestions.length
    });
  } catch (error) {
    console.error('Error applying updates:', error);
    res.status(500).json({ 
      error: 'Failed to apply updates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documentation/pending-updates
 * Get pending documentation updates awaiting approval
 */
router.get('/pending-updates', async (req: Request, res: Response) => {
  try {
    const pending = await documentationSyncService.getPendingUpdates();
    res.json({ updates: pending });
  } catch (error) {
    console.error('Error fetching pending updates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pending updates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documentation/sync
 * Full sync: detect changes, generate updates, and return for review
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { baseBranch = 'HEAD~1' } = req.body;
    
    // Step 1: Detect changes
    const changes = await documentationSyncService.detectChanges(baseBranch);
    
    if (changes.affectedSections.length === 0) {
      return res.json({ 
        message: 'No documentation updates needed',
        changes,
        suggestions: []
      });
    }

    // Step 2: Generate AI updates (need to get detailed diff)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout: detailedDiff } = await execAsync(`git diff ${baseBranch}`);
    
    const suggestions = await documentationSyncService.generateAIUpdates(
      changes.affectedSections,
      detailedDiff
    );
    
    res.json({ 
      message: `${suggestions.length} documentation updates suggested`,
      changes,
      suggestions
    });
  } catch (error) {
    console.error('Error during documentation sync:', error);
    res.status(500).json({ 
      error: 'Failed to sync documentation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
