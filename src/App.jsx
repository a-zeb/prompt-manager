import React, { useState, useEffect, useMemo } from 'react';
import {
  AppBar, Toolbar, Typography, Box, TextField, Button,
  List, ListItem, ListItemButton, ListItemText, IconButton,
  Divider, Paper, Chip, Stack, Alert, Snackbar, CircularProgress, ThemeProvider, createTheme,
  CssBaseline, Tab, Tabs, InputAdornment, Tooltip, Avatar
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  AutoFixHigh as OptimizeIcon,
  Analytics as AnalyzeIcon,
  Search as SearchIcon,
  Folder as FolderIcon,
  History as HistoryIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ChatBubbleOutline as FeedbackIcon,
  AutoAwesome as PatternIcon
} from '@mui/icons-material';
import { aiService, promptService } from './services/api';

// Error Boundary for stability
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <Box sx={{ p: 4 }}><Alert severity="error">Interface encountered an error. Please refresh.</Alert></Box>;
    return this.props.children;
  }
}

function AppContent() {
  const [mode, setMode] = useState('dark');
  const [tabValue, setTabValue] = useState(0); // 0: Prompt, 1: Patterns, 2: History
  const [rawPrompt, setRawPrompt] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [advice, setAdvice] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState('');
  const [lastOptimizedInput, setLastOptimizedInput] = useState('');
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Mock/Live State for 3rd column history
  const [feedbackHistory, setFeedbackHistory] = useState([
    { id: 1, text: "Mistral-3B suggested adding a clear 'Role' to your code review prompt.", date: new Date('2026-02-09T10:05:00Z') },
    { id: 2, text: "Model noted that your mystery prompt lacked a specific 'Tone' constraint.", date: new Date('2026-02-08T14:35:00Z') },
  ]);

  const [analysisHistoryList, setAnalysisHistoryList] = useState([
    { id: 1, text: "Pattern found: You consistently omit the 'Context' component in 80% of your marketing prompts.", date: new Date('2026-02-07T10:00:00Z') },
  ]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#58a6ff' },
      secondary: { main: mode === 'dark' ? '#3fb950' : '#238636' },
      background: {
        default: mode === 'dark' ? '#0d1117' : '#f6f8fa',
        paper: mode === 'dark' ? '#161b22' : '#ffffff',
      },
      divider: mode === 'dark' ? '#30363d' : '#d0d7de',
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 }
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: 6, boxShadow: 'none' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: mode === 'dark' ? '#30363d' : '#d0d7de', borderRadius: 10 },
          }
        }
      }
    }
  }), [mode]);

  useEffect(() => { fetchPrompts(); }, []);

  const fetchPrompts = async () => {
    try {
      const data = await promptService.getAll();
      setPrompts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPrompts([]);
    }
  };

  const handleOptimize = async () => {
    if (!rawPrompt.trim()) return;
    setLoading(true);
    setAdvice('');
    try {
      const result = await aiService.optimize(rawPrompt);
      setOptimizedPrompt(result.final_prompt);
      setAdvice(result.advice || 'Prompt optimized for CO-STAR structure.');
      setLastOptimizedInput(rawPrompt);

      // Update individual feedback history
      setFeedbackHistory(prev => [{
        id: Date.now(),
        text: result.advice || "Optimization completed with CO-STAR structure.",
        date: new Date()
      }, ...prev]);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (prompts.length === 0) return;
    setAnalyzing(true);
    try {
      const latestPrompts = prompts.slice(0, 10).map(p => p.raw_content);
      const result = await aiService.analyze(latestPrompts);
      setLastAnalysis(result.feedback);

      // Update analysis history
      setAnalysisHistoryList(prev => [{
        id: Date.now(),
        text: result.feedback,
        date: new Date()
      }, ...prev]);

    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (content = rawPrompt, optimized = null) => {
    if (!content.trim()) return;
    try {
      if (optimized === null && activeDraftId) {
        // Update existing draft
        await promptService.update(activeDraftId, {
          title: content.substring(0, 40).replace(/\n/g, ' ') + (content.length > 40 ? '...' : ''),
          raw_content: content
        });
        setSnackbar({ open: true, message: 'Draft updated successfully!', severity: 'success' });
      } else {
        // Create new entry
        await promptService.create({
          title: content.substring(0, 40).replace(/\n/g, ' ') + (content.length > 40 ? '...' : ''),
          raw_content: content,
          optimized_content: optimized
        });
        // If we saved to registry, we might want to clear the active draft
        if (optimized !== null) {
          setActiveDraftId(null);
          setSnackbar({ open: true, message: 'Prompt saved to registry!', severity: 'success' });
        } else {
          setSnackbar({ open: true, message: 'Draft saved successfully!', severity: 'success' });
        }
      }
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditDraft = (item) => {
    setRawPrompt(item.raw_content);
    setOptimizedPrompt('');
    setAdvice('');
    setLastOptimizedInput('');
    setActiveDraftId(item._id);
    setTabValue(0);
  };

  const handleDelete = async (id) => {
    try {
      await promptService.delete(id);
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAnalysis = (id) => {
    setAnalysisHistoryList(prev => prev.filter(item => (item.id || item._id) !== id));
  };

  const sortedPrompts = useMemo(() => {
    return [...prompts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [prompts]);

  const filteredPrompts = sortedPrompts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.raw_content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', bgcolor: 'background.default', overflow: 'hidden' }}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', zIndex: 1100 }}>
          <Toolbar variant="dense">
            <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5 }}>
              Prompt Manager / <Typography component="span" variant="inherit" color="primary">{tabValue === 0 ? "Prompt" : tabValue === 1 ? "Patterns" : "History"}</Typography>
            </Typography>
            <IconButton onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} color="inherit" size="small">
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Toolbar>
        </AppBar>

        <Grid container columns={12} sx={{ flexGrow: 1, overflow: 'hidden', flexWrap: 'nowrap', width: '100%' }}>
          {/* Column 1: Navigation (16.6%) */}
          <Grid item sx={{
            flex: '0 0 16.666667%',
            maxWidth: '16.666667%',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ mb: 2 }}
              />
              <List sx={{ '& .MuiListItemButton-root': { py: 0.5, borderRadius: 1.5, mb: 0.5 } }}>
                <ListItemButton selected={tabValue === 0} onClick={() => setTabValue(0)}>
                  <FolderIcon fontSize="small" sx={{ mr: 1.5, color: tabValue === 0 ? 'primary.main' : 'text.secondary' }} />
                  <ListItemText primary="Prompt" primaryTypographyProps={{ variant: 'body2', fontWeight: tabValue === 0 ? 600 : 400 }} />
                </ListItemButton>
                <ListItemButton selected={tabValue === 1} onClick={() => setTabValue(1)}>
                  <AnalyzeIcon sx={{ mr: 1.5, fontSize: '1.2rem', color: tabValue === 1 ? 'primary.main' : 'text.secondary' }} />
                  <ListItemText primary="Patterns" primaryTypographyProps={{ variant: 'body2', fontWeight: tabValue === 1 ? 600 : 400 }} />
                </ListItemButton>
                <ListItemButton selected={tabValue === 2} onClick={() => setTabValue(2)}>
                  <HistoryIcon fontSize="small" sx={{ mr: 1.5, color: tabValue === 2 ? 'primary.main' : 'text.secondary' }} />
                  <ListItemText primary="Registry" primaryTypographyProps={{ variant: 'body2', fontWeight: tabValue === 2 ? 600 : 400 }} />
                </ListItemButton>
              </List>
            </Box>
            <Divider />
            <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>SAVED PROMPTS</Typography>
              <List dense>
                {filteredPrompts.slice(0, 12).map(p => (
                  <ListItemButton key={p._id} onClick={() => { setRawPrompt(p.raw_content); setTabValue(0); }}>
                    <ListItemText primary={p.title} primaryTypographyProps={{ variant: 'caption', noWrap: true, color: 'text.secondary' }} />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          </Grid>

          {/* Column 2: Core Workspace (58.3%) */}
          <Grid item sx={{
            flex: '0 0 58.333333%',
            maxWidth: '58.333333%',
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'hidden'
          }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ minHeight: 48 }}>
                <Tab label="Prompt" sx={{ py: 1.5 }} />
                <Tab label="Patterns" sx={{ py: 1.5 }} />
                <Tab label="History" sx={{ py: 1.5 }} />
              </Tabs>
            </Box>

            <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
              {tabValue === 0 && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="overline" color="secondary" sx={{ fontWeight: 800, mb: 1, display: activeDraftId ? 'block' : 'none' }}>
                      Editing Active Draft
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={12}
                      placeholder="Draft your prompt here..."
                      value={rawPrompt}
                      onChange={(e) => setRawPrompt(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': { fontFamily: '"SF Mono", "Roboto Mono", monospace', fontSize: 13, bgcolor: 'background.paper' }
                      }}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-start' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <OptimizeIcon fontSize="small" />}
                        onClick={handleOptimize}
                        disabled={loading || !rawPrompt.trim()}
                      >
                        Optimize
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<SaveIcon fontSize="small" />}
                        onClick={() => handleSave(rawPrompt, optimizedPrompt)}
                        disabled={!optimizedPrompt || rawPrompt !== lastOptimizedInput}
                      >
                        Save to Registry
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSave(rawPrompt, null)}
                        disabled={!rawPrompt.trim()}
                      >
                        {activeDraftId ? "Update Draft" : "Save Draft"}
                      </Button>
                      {activeDraftId && (
                        <Button
                          variant="text"
                          size="small"
                          color="inherit"
                          onClick={() => {
                            setActiveDraftId(null);
                            setRawPrompt('');
                            setOptimizedPrompt('');
                            setAdvice('');
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </Stack>
                  </Box>

                  {(optimizedPrompt || advice) && (
                    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: mode === 'dark' ? 'rgba(88, 166, 255, 0.05)' : 'rgba(9, 105, 218, 0.05)', borderLeft: 4, borderLeftColor: 'primary.main' }}>
                      <Typography variant="overline" color="primary" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <OptimizeIcon fontSize="small" /> Optimized Content & Advice
                      </Typography>

                      {advice && (
                        <Box sx={{ mb: 2.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>STRATEGIC ADVICE</Typography>
                          <Typography variant="body2" sx={{ lineHeight: 1.6, color: 'text.primary' }}>
                            {advice}
                          </Typography>
                        </Box>
                      )}

                      {optimizedPrompt && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>CO-STAR REWRITE</Typography>
                          <Typography variant="body2" sx={{
                            p: 2,
                            bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 1,
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            color: 'text.primary'
                          }}>
                            {optimizedPrompt}
                          </Typography>
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<CopyIcon />}
                            sx={{ mt: 1, textTransform: 'none' }}
                            onClick={() => navigator.clipboard.writeText(optimizedPrompt)}
                          >
                            Copy to Clipboard
                          </Button>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Stack>
              )}

              {tabValue === 1 && (
                <Stack spacing={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Analytical Habit Review</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <AnalyzeIcon fontSize="small" />}
                      onClick={handleAnalyze}
                      disabled={analyzing || prompts.length === 0}
                      color="primary"
                    >
                      {analyzing ? 'Scanning Habits...' : 'Analyze Patterns'}
                    </Button>
                  </Stack>

                  {lastAnalysis && (
                    <Paper variant="outlined" sx={{
                      p: 2.5,
                      mt: 1,
                      bgcolor: mode === 'dark' ? 'rgba(156, 39, 176, 0.05)' : 'rgba(156, 39, 176, 0.05)',
                      borderLeft: 4,
                      borderLeftColor: 'secondary.main'
                    }}>
                      <Typography variant="overline" color="secondary" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <AnalyzeIcon fontSize="small" /> Behavioral Pattern Analysis
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.primary' }}>
                        {lastAnalysis}
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              )}

              {tabValue === 2 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 3, fontWeight: 700 }}>Comprehensive Audit History</Typography>

                  {/* Active Drafts Section */}
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, mb: 1.5, display: 'block' }}>Active Drafts</Typography>
                  {prompts.filter(p => !p.optimized_content).length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontStyle: 'italic' }}>No active drafts found.</Typography>
                  ) : (
                    prompts.filter(p => !p.optimized_content).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item) => (
                      <Paper key={item._id} variant="outlined" sx={{ p: 2, mb: 2, borderLeft: 4, borderLeftColor: mode === 'dark' ? '#f0883e' : '#e36209' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: mode === 'dark' ? '#f0883e' : '#e36209' }}>{item.title}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString()}</Typography>
                            <IconButton size="small" onClick={() => handleEditDraft(item)}>
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDelete(item._id)}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <FolderIcon fontSize="inherit" /> DRAFT
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}>
                            {item.raw_content}
                          </Typography>
                        </Box>
                      </Paper>
                    ))
                  )}

                  <Divider sx={{ my: 4 }} />

                  {/* Saved Registry Section */}
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, mb: 1.5, display: 'block' }}>Saved Registry</Typography>
                  {prompts.filter(p => p.optimized_content).length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontStyle: 'italic' }}>No saved prompts found.</Typography>
                  ) : (
                    prompts.filter(p => p.optimized_content).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item) => (
                      <Paper key={item._id} variant="outlined" sx={{ p: 2, mb: 2, borderLeft: 4, borderLeftColor: 'primary.main' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" color="primary">{item.title}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString()}</Typography>
                            <IconButton size="small" color="error" onClick={() => handleDelete(item._id)}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        </Box>
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <FolderIcon fontSize="inherit" /> RAW PROMPT
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}>
                              {item.raw_content}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="primary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <OptimizeIcon fontSize="inherit" /> OPTIMIZED VERSION
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: mode === 'dark' ? 'rgba(88, 166, 255, 0.05)' : 'rgba(9, 105, 218, 0.05)', borderRadius: 1, fontSize: 12 }}>
                              {item.optimized_content}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))
                  )}

                  <Divider sx={{ my: 4 }} />

                  {/* Analysis Logs Section */}
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, mb: 1.5, display: 'block' }}>Habit Analysis Logs</Typography>
                  {analysisHistoryList.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontStyle: 'italic' }}>No analysis runs yet.</Typography>
                  ) : (
                    analysisHistoryList.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, idx) => (
                      <Paper key={item.id || idx} variant="outlined" sx={{ p: 2, mb: 2, borderLeft: 4, borderLeftColor: 'secondary.main' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" color="secondary">Habit Pattern Scan</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">{new Date(item.date).toLocaleString()}</Typography>
                            <IconButton size="small" color="error" onClick={() => handleDeleteAnalysis(item.id || item._id)}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Stack>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AnalyzeIcon fontSize="inherit" /> HABIT ANALYSIS
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}>
                            {item.text}
                          </Typography>
                        </Box>
                      </Paper>
                    ))
                  )}
                </Box>
              )}
            </Box>
          </Grid>

          {/* Column 3: Dynamic Details (25%) */}
          <Grid item sx={{
            flex: '0 0 25%',
            maxWidth: '25%',
            p: 3,
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                {tabValue === 0 ? "FEEDBACK HISTORY" : tabValue === 1 ? "ANALYSIS LOGS" : "REGISTRY TOOLS"}
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
              {tabValue === 0 && (
                <Stack spacing={2}>
                  {feedbackHistory.map(item => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1.5, position: 'relative' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 10 }}>M3</Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(item.date).toLocaleDateString()}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: 12, color: 'text.secondary' }}>{item.text}</Typography>
                    </Paper>
                  ))}
                </Stack>
              )}

              {tabValue === 1 && (
                <Stack spacing={2}>
                  {analysisHistoryList.map(item => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.main', fontSize: 10 }}>M7</Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{new Date(item.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: 12, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.text}</Typography>
                    </Paper>
                  ))}
                </Stack>
              )}

              {tabValue === 2 && (
                <Stack spacing={2}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <Typography variant="caption" fontWeight={700}>System Stats</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Total Registry</Typography>
                        <Typography variant="caption" fontWeight={700}>{prompts.length}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Analysis Runs</Typography>
                        <Typography variant="caption" fontWeight={700}>{analysisHistoryList.length}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  <Button fullWidth variant="outlined" startIcon={<SaveIcon />} onClick={() => setTabValue(0)}>New Collection</Button>
                </Stack>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Visual Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider >
  );
}

// Global Custom Scrollbar for premium feel
const GlobalStylesContext = () => (
  <style>{`
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #484f58; }
  `}</style>
);

function App() {
  return (
    <ErrorBoundary>
      <GlobalStylesContext />
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
