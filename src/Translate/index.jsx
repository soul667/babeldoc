import { useState, useEffect, useRef } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    TextField,
    Typography,
    Switch,
    FormControlLabel,
    Divider,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Chip
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DescriptionIcon from '@mui/icons-material/Description'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PendingIcon from '@mui/icons-material/Pending'

// Apple-style theme constants
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const GLASS_BG = 'rgba(255, 255, 255, 0.8)'
const GLASS_BORDER = '1px solid rgba(255, 255, 255, 0.3)'
const SHADOW_SM = '0 2px 8px rgba(0, 0, 0, 0.05)'
const SHADOW_MD = '0 4px 16px rgba(0, 0, 0, 0.08)'
const RADIUS_LG = '16px'
const RADIUS_MD = '12px'

export default function Translate({ enterAction }) {
    // Detect uTools theme
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check if uTools API is available and get theme
        if (window.utools && window.utools.isDarkColors) {
            return window.utools.isDarkColors()
        }
        return false
    })

    // File list state - each file has: { id, path, name, status, progress, statusMessage }
    const [files, setFiles] = useState([])
    const [apiKey, setApiKey] = useState(localStorage.getItem('babeldoc_apiKey') || '')
    const [model, setModel] = useState(localStorage.getItem('babeldoc_model') || 'gpt-4o')
    const [baseUrl, setBaseUrl] = useState(localStorage.getItem('babeldoc_baseUrl') || 'https://api.openai.com/v1')
    const [prompt, setPrompt] = useState(localStorage.getItem('babeldoc_prompt') || 'Translate this PDF to Chinese.')

    // Advanced Settings State
    const [advancedSettings, setAdvancedSettings] = useState(() => {
        const saved = localStorage.getItem('babeldoc_advanced')
        return saved ? JSON.parse(saved) : {
            // General
            qps: 10,
            watermarkOutputMode: 'watermarked',
            debug: false,
            showCharBox: false,
            // PDF Processing
            pages: '',
            splitShortLines: false,
            ocrWorkaround: false,
            enhanceCompatibility: false,
            // Translation
            glossaryFiles: '',
            minTextLength: 5
        }
    })

    const [logs, setLogs] = useState([])
    const [running, setRunning] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [currentFileIndex, setCurrentFileIndex] = useState(-1)
    const logEndRef = useRef(null)
    const fileInputRef = useRef(null)

    // Listen for theme changes
    useEffect(() => {
        const handleThemeChange = () => {
            if (window.utools && window.utools.isDarkColors) {
                setIsDarkMode(window.utools.isDarkColors())
            }
        }

        // Listen for uTools theme change event if available
        if (window.utools && window.utools.onPluginEnter) {
            window.addEventListener('focus', handleThemeChange)
        }

        return () => {
            window.removeEventListener('focus', handleThemeChange)
        }
    }, [])

    // Add files from enterAction
    useEffect(() => {
        if (enterAction.type === 'files' && enterAction.payload.length > 0) {
            const newFiles = enterAction.payload.map((file, index) => ({
                id: Date.now() + index,
                path: file.path,
                name: file.name || file.path.split('\\').pop().split('/').pop(),
                status: 'pending', // pending, translating, completed, failed
                progress: 0,
                statusMessage: '等待翻译'
            }))
            setFiles(prev => [...prev, ...newFiles])
        }
    }, [enterAction])

    useEffect(() => {
        if (running) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, running])

    // Add files via file picker
    const handleAddFiles = () => {
        if (window.utools && window.utools.showOpenDialog) {
            const paths = window.utools.showOpenDialog({
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
                properties: ['openFile', 'multiSelections']
            })
            if (paths && paths.length > 0) {
                const newFiles = paths.map((path, index) => ({
                    id: Date.now() + index,
                    path: path,
                    name: path.split('\\').pop().split('/').pop(),
                    status: 'pending',
                    progress: 0,
                    statusMessage: '等待翻译'
                }))
                setFiles(prev => [...prev, ...newFiles])
            }
        }
    }

    // Remove file from list
    const handleRemoveFile = (fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId))
    }

    // Update individual file status
    const updateFileStatus = (fileId, updates) => {
        setFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, ...updates } : f
        ))
    }

    const saveSettings = () => {
        localStorage.setItem('babeldoc_apiKey', apiKey)
        localStorage.setItem('babeldoc_model', model)
        localStorage.setItem('babeldoc_baseUrl', baseUrl)
        localStorage.setItem('babeldoc_prompt', prompt)
        localStorage.setItem('babeldoc_advanced', JSON.stringify(advancedSettings))

        setShowSettings(false)
        window.utools.showNotification('设置已保存')
    }

    const handleAdvancedChange = (key, value) => {
        setAdvancedSettings(prev => ({ ...prev, [key]: value }))
    }

    const parseLogStatus = (log, fileId) => {
        // Try to extract overall_progress from various log formats
        // Format 1: 'overall_progress': 13.159218108456686
        const progressMatch = log.match(/'overall_progress':\s*([\d.]+)/)
        if (progressMatch) {
            const progressValue = parseFloat(progressMatch[1])
            if (!isNaN(progressValue)) {
                updateFileStatus(fileId, { progress: progressValue })
            }
        }

        // Try to extract stage information
        // Format: 'stage': 'Parse Page Layout'
        const stageMatch = log.match(/'stage':\s*'([^']+)'/)
        if (stageMatch && progressMatch) {
            const stageName = stageMatch[1]
            const progressValue = parseFloat(progressMatch[1])
            return `${stageName} (${Math.round(progressValue)}%)`
        }

        // Fallback: Try to parse complete JSON (for single-line logs)
        const jsonMatch = log.match(/DEBUG:babeldoc\.main:(\{.*\})/)
        if (jsonMatch) {
            try {
                let jsonStr = jsonMatch[1].replace(/'/g, '"')
                const data = JSON.parse(jsonStr)

                if (data.overall_progress !== undefined) {
                    updateFileStatus(fileId, { progress: data.overall_progress })
                }
                if (data.stage) {
                    return `${data.stage} (${Math.round(data.overall_progress)}%)`
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Legacy status messages
        if (log.includes('Loading ONNX model')) return '正在加载模型...'
        if (log.includes('start to translate')) return '开始翻译...'
        if (log.includes('Automatic Term Extraction')) return '正在提取术语...'
        if (log.includes('Found title paragraph')) return '正在分析文档结构...'
        if (log.includes('Translation result')) return '正在翻译段落...'
        if (log.includes('Fallback to simple translation')) return '正在进行简单翻译...'
        return null
    }

    const translateFile = async (file) => {
        return new Promise((resolve) => {
            updateFileStatus(file.id, {
                status: 'translating',
                progress: 0,
                statusMessage: '准备开始...'
            })

            window.services.runBabeldoc({
                file: file.path,
                apiKey,
                model,
                baseUrl,
                prompt,
                ...advancedSettings
            }, (event) => {
                if (event.type === 'stdout' || event.type === 'stderr') {
                    const log = event.data
                    setLogs(prev => [...prev, log])
                    const status = parseLogStatus(log, file.id)
                    if (status) {
                        updateFileStatus(file.id, { statusMessage: status })
                    }
                } else if (event.type === 'close') {
                    setLogs(prev => [...prev, `\nProcess exited with code ${event.code}`])
                    if (event.code === 0) {
                        updateFileStatus(file.id, {
                            status: 'completed',
                            progress: 100,
                            statusMessage: '翻译完成！'
                        })
                    } else {
                        updateFileStatus(file.id, {
                            status: 'failed',
                            statusMessage: '翻译失败'
                        })
                    }
                    resolve(event.code)
                }
            })
        })
    }

    const handleRun = async () => {
        if (files.length === 0) {
            window.utools.showNotification('请先添加文件')
            return
        }

        if (!apiKey) {
            window.utools.showNotification('请先配置 API Key')
            setShowSettings(true)
            return
        }

        setRunning(true)
        setLogs([])

        // Translate files one by one
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.status === 'pending' || file.status === 'failed') {
                setCurrentFileIndex(i)
                await translateFile(file)
            }
        }

        setRunning(false)
        setCurrentFileIndex(-1)
        window.utools.showNotification('所有文件翻译完成！')
    }

    // Theme colors
    const theme = {
        bg: {
            primary: isDarkMode ? '#1c1c1e' : '#ffffff',
            secondary: isDarkMode ? '#2c2c2e' : '#f5f5f7',
            tertiary: isDarkMode ? '#3a3a3c' : '#e5e5e7',
            gradient: isDarkMode ? '#2c2c2e' : 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)',
            empty: isDarkMode ? '#2c2c2e' : '#f8f9ff'
        },
        text: {
            primary: isDarkMode ? '#ffffff' : '#1d1d1f',
            secondary: isDarkMode ? '#98989d' : '#6e6e73',
            tertiary: isDarkMode ? '#636366' : '#86868b'
        },
        border: {
            primary: isDarkMode ? '#3a3a3c' : '#e5e5e5',
            secondary: isDarkMode ? '#48484a' : '#e0e7ff',
            focus: '#007AFF'
        },
        shadow: {
            sm: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.05)',
            md: isDarkMode ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.08)',
            hover: isDarkMode ? '0 2px 12px rgba(0, 122, 255, 0.3)' : '0 2px 12px rgba(0, 122, 255, 0.08)'
        },
        accent: {
            blue: '#007AFF',
            blueHover: '#0062cc',
            blueBg: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
            green: '#34c759',
            red: '#ff3b30',
            gray: '#8e8e93'
        }
    }

    return (
        <Container maxWidth="md" sx={{
            py: 4,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: APPLE_FONT,
            bgcolor: theme.bg.primary,
            color: theme.text.primary
        }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{
                        width: 48, height: 48, borderRadius: RADIUS_MD, bgcolor: theme.accent.blue, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: theme.shadow.sm
                    }}>
                        <DescriptionIcon fontSize="large" />
                    </Box>
                    <Typography variant="h4" component="h1" fontWeight="700" sx={{ letterSpacing: '-0.5px', color: theme.text.primary }}>
                        Babeldoc
                    </Typography>
                </Stack>
                <IconButton onClick={() => setShowSettings(true)} sx={{ bgcolor: theme.bg.secondary, '&:hover': { bgcolor: theme.bg.tertiary } }}>
                    <SettingsIcon sx={{ color: theme.text.primary }} />
                </IconButton>
            </Box>

            {/* File List Section */}
            <Paper elevation={0} sx={{
                p: 3, mb: 3, borderRadius: RADIUS_LG,
                bgcolor: theme.bg.primary,
                border: `1px solid ${theme.border.primary}`,
                boxShadow: theme.shadow.sm
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight="600" sx={{ fontSize: '1.1rem', color: theme.text.primary }}>
                        PDF Files
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleAddFiles}
                        disabled={running}
                        sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            borderColor: theme.accent.blue,
                            color: theme.accent.blue,
                            '&:hover': {
                                borderColor: theme.accent.blueHover,
                                bgcolor: theme.accent.blueBg
                            },
                            '&:disabled': {
                                borderColor: theme.border.primary,
                                color: theme.text.tertiary
                            }
                        }}
                    >
                        Add Files
                    </Button>
                </Stack>

                {files.length === 0 && (
                    <Box sx={{
                        py: 6,
                        textAlign: 'center',
                        borderRadius: RADIUS_MD,
                        border: `2px dashed ${theme.border.secondary}`,
                        bgcolor: theme.bg.empty
                    }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: theme.accent.blue, opacity: 0.4, mb: 2 }} />
                        <Typography variant="body1" color={theme.text.secondary} gutterBottom>
                            No files added yet
                        </Typography>
                        <Typography variant="body2" color={theme.text.secondary}>
                            Click "Add Files" or drag PDFs through uTools
                        </Typography>
                    </Box>
                )}

                {files.length > 0 && (
                    <Stack spacing={1.5}>
                        {files.map((file) => {
                            const statusColor = file.status === 'completed' ? theme.accent.green :
                                file.status === 'failed' ? theme.accent.red :
                                    file.status === 'translating' ? theme.accent.blue : theme.accent.gray

                            const StatusIcon = file.status === 'completed' ? CheckCircleIcon :
                                file.status === 'failed' ? ErrorIcon :
                                    file.status === 'translating' ? null : PendingIcon

                            return (
                                <Paper key={file.id} elevation={0} sx={{
                                    p: 1.5,
                                    borderRadius: '10px',
                                    border: `1px solid ${theme.border.primary}`,
                                    bgcolor: theme.bg.primary,
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: theme.accent.blue,
                                        boxShadow: theme.shadow.hover
                                    }
                                }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Box sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '6px',
                                            bgcolor: theme.accent.blueBg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: theme.accent.blue,
                                            flexShrink: 0
                                        }}>
                                            <DescriptionIcon sx={{ fontSize: 18 }} />
                                        </Box>

                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                <Typography variant="body2" fontWeight="500" sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: '0.875rem',
                                                    color: theme.text.primary
                                                }}>
                                                    {file.name}
                                                </Typography>

                                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                                    {StatusIcon && <StatusIcon sx={{ fontSize: 14, color: statusColor }} />}
                                                    <Chip
                                                        label={file.status === 'pending' ? 'Pending' :
                                                            file.status === 'translating' ? 'Translating' :
                                                                file.status === 'completed' ? 'Completed' :
                                                                    'Failed'}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: `${statusColor}15`,
                                                            color: statusColor,
                                                            fontWeight: '600',
                                                            height: '20px',
                                                            fontSize: '0.65rem'
                                                        }}
                                                    />
                                                </Stack>
                                            </Stack>

                                            {file.status === 'translating' && (
                                                <Box sx={{ mt: 1 }}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                        <Typography variant="body2" color={theme.text.secondary} sx={{ fontSize: '0.8rem' }}>
                                                            {file.statusMessage}
                                                        </Typography>
                                                        <Typography variant="body2" fontWeight="600" color={theme.accent.blue} sx={{ fontSize: '0.8rem' }}>
                                                            {Math.round(file.progress)}%
                                                        </Typography>
                                                    </Stack>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={file.progress}
                                                        sx={{
                                                            height: 3,
                                                            borderRadius: 2,
                                                            bgcolor: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : '#f0f4ff',
                                                            '& .MuiLinearProgress-bar': {
                                                                bgcolor: theme.accent.blue,
                                                                borderRadius: 2
                                                            }
                                                        }}
                                                    />
                                                </Box>
                                            )}
                                        </Box>

                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemoveFile(file.id)}
                                            disabled={file.status === 'translating'}
                                            sx={{
                                                color: theme.accent.red,
                                                padding: '4px',
                                                '&:hover': {
                                                    bgcolor: `${theme.accent.red}15`
                                                },
                                                '&:disabled': {
                                                    color: theme.accent.gray
                                                }
                                            }}
                                        >
                                            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Stack>
                                </Paper>
                            )
                        })}
                    </Stack>
                )}
            </Paper>

            <Button
                variant="contained"
                size="large"
                onClick={handleRun}
                disabled={running || files.length === 0}
                fullWidth
                startIcon={!running && <PlayArrowIcon />}
                sx={{
                    mb: 4, height: 56, fontSize: '1.1rem', borderRadius: RADIUS_MD, textTransform: 'none', fontWeight: '600',
                    bgcolor: theme.accent.blue, boxShadow: running ? 'none' : theme.shadow.md,
                    '&:hover': { bgcolor: theme.accent.blueHover, boxShadow: theme.shadow.sm },
                    '&:disabled': { bgcolor: theme.bg.secondary, color: theme.text.tertiary }
                }}
            >
                {running ? `Translating... (${currentFileIndex + 1}/${files.length})` : 'Start Translation'}
            </Button>

            {/* Status & Progress - removed, now shown in individual file cards */}

            {/* Logs - Only show when user enables debug */}
            {running && advancedSettings.debug && (
                <Paper elevation={0} sx={{
                    flex: 1, overflow: 'auto', p: 2, borderRadius: RADIUS_MD,
                    bgcolor: isDarkMode ? '#1c1c1e' : '#1d1d1f',
                    color: '#f5f5f7',
                    fontFamily: 'SF Mono, Menlo, monospace', fontSize: '0.85rem',
                    border: `1px solid ${isDarkMode ? '#3a3a3c' : '#333'}`,
                    maxHeight: '200px'
                }}>
                    {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                    ))}
                    <div ref={logEndRef} />
                </Paper>
            )}

            {/* Settings Dialog */}
            <Dialog
                open={showSettings}
                onClose={() => setShowSettings(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: RADIUS_LG,
                        bgcolor: theme.bg.primary,
                        color: theme.text.primary
                    }
                }}
            >
                <DialogTitle sx={{
                    fontWeight: '700',
                    borderBottom: `1px solid ${theme.border.primary}`,
                    color: theme.text.primary
                }}>
                    Configuration
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 3 }}>
                        {/* Main Settings */}
                        <Stack spacing={3} sx={{ mb: 3 }}>
                            <TextField
                                label="API Key"
                                type="password"
                                fullWidth
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                variant="outlined"
                                helperText="Your OpenAI API Key"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: theme.bg.primary,
                                        '& fieldset': { borderColor: theme.border.primary },
                                        '&:hover fieldset': { borderColor: theme.border.focus },
                                    },
                                    '& .MuiInputLabel-root': { color: theme.text.secondary },
                                    '& .MuiFormHelperText-root': { color: theme.text.tertiary },
                                    '& input': { color: theme.text.primary }
                                }}
                            />
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Model"
                                        fullWidth
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        variant="outlined"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: theme.bg.primary,
                                                '& fieldset': { borderColor: theme.border.primary },
                                                '&:hover fieldset': { borderColor: theme.border.focus },
                                            },
                                            '& .MuiInputLabel-root': { color: theme.text.secondary },
                                            '& input': { color: theme.text.primary }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="Base URL"
                                        fullWidth
                                        value={baseUrl}
                                        onChange={e => setBaseUrl(e.target.value)}
                                        variant="outlined"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: theme.bg.primary,
                                                '& fieldset': { borderColor: theme.border.primary },
                                                '&:hover fieldset': { borderColor: theme.border.focus },
                                            },
                                            '& .MuiInputLabel-root': { color: theme.text.secondary },
                                            '& input': { color: theme.text.primary }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                            <TextField
                                label="System Prompt"
                                fullWidth
                                multiline
                                rows={4}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                variant="outlined"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: theme.bg.primary,
                                        '& fieldset': { borderColor: theme.border.primary },
                                        '&:hover fieldset': { borderColor: theme.border.focus },
                                    },
                                    '& .MuiInputLabel-root': { color: theme.text.secondary },
                                    '& textarea': { color: theme.text.primary }
                                }}
                            />
                        </Stack>

                        <Divider sx={{ my: 2, borderColor: theme.border.primary }} />
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '1rem', mt: 2, color: theme.text.primary }}>
                            Advanced Settings
                        </Typography>

                        {/* Advanced Settings Groups */}
                        <Stack spacing={1}>
                            <Accordion elevation={0} sx={{
                                border: `1px solid ${theme.border.primary}`,
                                borderRadius: '8px !important',
                                '&:before': { display: 'none' },
                                bgcolor: theme.bg.primary
                            }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: theme.text.primary }} />}>
                                    <Typography fontWeight="500" sx={{ color: theme.text.primary }}>General & Output</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="QPS"
                                                type="number"
                                                fullWidth
                                                size="small"
                                                value={advancedSettings.qps}
                                                onChange={e => handleAdvancedChange('qps', e.target.value)}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        bgcolor: theme.bg.primary,
                                                        '& fieldset': { borderColor: theme.border.primary },
                                                    },
                                                    '& .MuiInputLabel-root': { color: theme.text.secondary },
                                                    '& input': { color: theme.text.primary }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ color: theme.text.secondary }}>Watermark Mode</InputLabel>
                                                <Select
                                                    value={advancedSettings.watermarkOutputMode}
                                                    label="Watermark Mode"
                                                    onChange={e => handleAdvancedChange('watermarkOutputMode', e.target.value)}
                                                    sx={{
                                                        bgcolor: theme.bg.primary,
                                                        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.border.primary },
                                                        '& .MuiSelect-select': { color: theme.text.primary }
                                                    }}
                                                >
                                                    <MenuItem value="watermarked">Watermarked</MenuItem>
                                                    <MenuItem value="no_watermark">No Watermark</MenuItem>
                                                    <MenuItem value="both">Both</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <FormControlLabel
                                                control={<Switch checked={advancedSettings.debug} onChange={e => handleAdvancedChange('debug', e.target.checked)} />}
                                                label={<Typography sx={{ color: theme.text.primary }}>Enable Debug Mode</Typography>}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <FormControlLabel
                                                control={<Switch checked={advancedSettings.showCharBox} onChange={e => handleAdvancedChange('showCharBox', e.target.checked)} />}
                                                label={<Typography sx={{ color: theme.text.primary }}>Show Character Boxes (Debug)</Typography>}
                                            />
                                        </Grid>
                                    </Grid>
                                </AccordionDetails>
                            </Accordion>

                            <Accordion elevation={0} sx={{
                                border: `1px solid ${theme.border.primary}`,
                                borderRadius: '8px !important',
                                '&:before': { display: 'none' },
                                bgcolor: theme.bg.primary
                            }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: theme.text.primary }} />}>
                                    <Typography fontWeight="500" sx={{ color: theme.text.primary }}>PDF Processing</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Pages (e.g., 1,2,5-10)"
                                            fullWidth
                                            size="small"
                                            value={advancedSettings.pages}
                                            onChange={e => handleAdvancedChange('pages', e.target.value)}
                                            helperText="Leave empty to translate all pages"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: theme.bg.primary,
                                                    '& fieldset': { borderColor: theme.border.primary },
                                                },
                                                '& .MuiInputLabel-root': { color: theme.text.secondary },
                                                '& .MuiFormHelperText-root': { color: theme.text.tertiary },
                                                '& input': { color: theme.text.primary }
                                            }}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={advancedSettings.splitShortLines} onChange={e => handleAdvancedChange('splitShortLines', e.target.checked)} />}
                                            label={<Typography sx={{ color: theme.text.primary }}>Split Short Lines</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={advancedSettings.ocrWorkaround} onChange={e => handleAdvancedChange('ocrWorkaround', e.target.checked)} />}
                                            label={<Typography sx={{ color: theme.text.primary }}>OCR Workaround (for scanned PDFs)</Typography>}
                                        />
                                        <FormControlLabel
                                            control={<Switch checked={advancedSettings.enhanceCompatibility} onChange={e => handleAdvancedChange('enhanceCompatibility', e.target.checked)} />}
                                            label={<Typography sx={{ color: theme.text.primary }}>Enhance Compatibility</Typography>}
                                        />
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>

                            <Accordion elevation={0} sx={{
                                border: `1px solid ${theme.border.primary}`,
                                borderRadius: '8px !important',
                                '&:before': { display: 'none' },
                                bgcolor: theme.bg.primary
                            }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: theme.text.primary }} />}>
                                    <Typography fontWeight="500" sx={{ color: theme.text.primary }}>Translation</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Glossary Files (comma separated)"
                                            fullWidth
                                            size="small"
                                            value={advancedSettings.glossaryFiles}
                                            onChange={e => handleAdvancedChange('glossaryFiles', e.target.value)}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: theme.bg.primary,
                                                    '& fieldset': { borderColor: theme.border.primary },
                                                },
                                                '& .MuiInputLabel-root': { color: theme.text.secondary },
                                                '& input': { color: theme.text.primary }
                                            }}
                                        />
                                        <TextField
                                            label="Min Text Length"
                                            type="number"
                                            fullWidth
                                            size="small"
                                            value={advancedSettings.minTextLength}
                                            onChange={e => handleAdvancedChange('minTextLength', e.target.value)}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: theme.bg.primary,
                                                    '& fieldset': { borderColor: theme.border.primary },
                                                },
                                                '& .MuiInputLabel-root': { color: theme.text.secondary },
                                                '& input': { color: theme.text.primary }
                                            }}
                                        />
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{
                    p: 2,
                    borderTop: `1px solid ${theme.border.primary}`,
                    bgcolor: isDarkMode ? theme.bg.secondary : '#fbfbfd'
                }}>
                    <Button onClick={() => setShowSettings(false)} sx={{ color: theme.text.secondary }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={saveSettings}
                        variant="contained"
                        sx={{
                            borderRadius: '8px',
                            px: 3,
                            fontWeight: '600',
                            boxShadow: 'none',
                            bgcolor: theme.accent.blue,
                            '&:hover': { bgcolor: theme.accent.blueHover }
                        }}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
