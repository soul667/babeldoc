import { useState, useEffect } from 'react'
import {
    Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Paper, Stack, TextField, Typography,
    FormControl, InputLabel, Select, MenuItem, CircularProgress
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const RADIUS_LG = '16px'
const RADIUS_MD = '12px'

export default function TextTranslate({ enterAction }) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (window.utools && window.utools.isDarkColors) {
            return window.utools.isDarkColors()
        }
        return false
    })

    const [apiKey, setApiKey] = useState(window.utools?.dbStorage?.getItem('text_translate_apiKey') || '')
    const [model, setModel] = useState(window.utools?.dbStorage?.getItem('text_translate_model') || 'qwen3-max')
    const [baseUrl, setBaseUrl] = useState(window.utools?.dbStorage?.getItem('text_translate_baseUrl') || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    const [prompt, setPrompt] = useState(window.utools?.dbStorage?.getItem('text_translate_prompt') || 'You are a professional translator.')
    const [translateMode, setTranslateMode] = useState(window.utools?.dbStorage?.getItem('text_translate_mode') || 'show')

    const [sourceText, setSourceText] = useState('')
    const [translatedText, setTranslatedText] = useState('')
    const [isTranslating, setIsTranslating] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    useEffect(() => {
        const handleThemeChange = () => {
            if (window.utools && window.utools.isDarkColors) {
                setIsDarkMode(window.utools.isDarkColors())
            }
        }
        if (window.utools && window.utools.onPluginEnter) {
            window.addEventListener('focus', handleThemeChange)
        }
        return () => window.removeEventListener('focus', handleThemeChange)
    }, [])

    useEffect(() => {
        if (enterAction.type === 'over' && enterAction.payload) {
            const text = typeof enterAction.payload === 'string' ? enterAction.payload : enterAction.payload.text || ''
            setSourceText(text)
            if (translateMode === 'copy' && text && apiKey) {
                handleTranslate(text, true)
            }
        }
    }, [enterAction, translateMode, apiKey])

    const theme = {
        bg: { primary: isDarkMode ? '#1c1c1e' : '#ffffff', secondary: isDarkMode ? '#2c2c2e' : '#f5f5f7', tertiary: isDarkMode ? '#3a3a3c' : '#e5e5e7' },
        text: { primary: isDarkMode ? '#ffffff' : '#1d1d1f', secondary: isDarkMode ? '#98989d' : '#6e6e73', tertiary: isDarkMode ? '#636366' : '#86868b' },
        border: { primary: isDarkMode ? '#3a3a3c' : '#e5e5e5', focus: '#007AFF' },
        shadow: { sm: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.05)', md: isDarkMode ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.08)' },
        accent: { blue: '#007AFF', blueHover: '#0062cc', blueBg: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)' }
    }

    const detectLanguage = (text) => /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en'

    const handleTranslate = async (text = sourceText, autoCopy = false) => {
        if (!text.trim()) {
            window.utools.showNotification('请输入要翻译的文本')
            return
        }
        if (!apiKey) {
            window.utools.showNotification('请先配置 API Key')
            setShowSettings(true)
            return
        }

        setIsTranslating(true)
        setTranslatedText('')

        try {
            const lang = detectLanguage(text)
            const targetLang = lang === 'zh' ? 'English' : 'Chinese'
            const userPrompt = `Translate the following text to ${targetLang}. Only return the translation, no explanations:\n\n${text}`

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: userPrompt }
                    ]
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const errorMsg = errorData.error?.message || `${response.status} ${response.statusText}`
                throw new Error(errorMsg)
            }

            const data = await response.json()
            const translation = data.choices[0]?.message?.content || ''
            setTranslatedText(translation)

            if (autoCopy || translateMode === 'copy') {
                window.utools.copyText(translation)
                window.utools.showNotification('翻译完成，已复制到剪贴板')
                if (autoCopy) {
                    window.utools.hideMainWindow()
                    window.utools.outPlugin()
                }
            } else {
                window.utools.showNotification('翻译完成')
            }
        } catch (error) {
            console.error('Translation error:', error)
            window.utools.showNotification(`翻译失败: ${error.message}`)
            setTranslatedText(`错误: ${error.message}`)
        } finally {
            setIsTranslating(false)
        }
    }

    const saveSettings = () => {
        window.utools.dbStorage.setItem('text_translate_apiKey', apiKey)
        window.utools.dbStorage.setItem('text_translate_model', model)
        window.utools.dbStorage.setItem('text_translate_baseUrl', baseUrl)
        window.utools.dbStorage.setItem('text_translate_prompt', prompt)
        window.utools.dbStorage.setItem('text_translate_mode', translateMode)
        setShowSettings(false)
        window.utools.showNotification('设置已保存')
    }

    const copyTranslation = () => {
        if (translatedText) {
            window.utools.copyText(translatedText)
            window.utools.showNotification('已复制到剪贴板')
        }
    }

    return (
        <Container maxWidth="md" sx={{ py: 4, height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: APPLE_FONT, bgcolor: theme.bg.primary, color: theme.text.primary }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ width: 48, height: 48, borderRadius: RADIUS_MD, bgcolor: theme.accent.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: theme.shadow.sm }}>
                        <SwapHorizIcon fontSize="large" />
                    </Box>
                    <Typography variant="h4" component="h1" fontWeight="700" sx={{ letterSpacing: '-0.5px', color: theme.text.primary }}>文本翻译</Typography>
                </Stack>
                <IconButton onClick={() => setShowSettings(true)} sx={{ bgcolor: theme.bg.secondary, '&:hover': { bgcolor: theme.bg.tertiary } }}>
                    <SettingsIcon sx={{ color: theme.text.primary }} />
                </IconButton>
            </Box>

            <Stack spacing={2} sx={{ flex: 1 }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: RADIUS_MD, bgcolor: theme.bg.primary, border: `1px solid ${theme.border.primary}`, boxShadow: theme.shadow.sm }}>
                    <Typography variant="caption" color={theme.text.secondary} fontWeight="600" sx={{ mb: 1, display: 'block' }}>原文</Typography>
                    <TextField multiline rows={8} fullWidth variant="outlined" placeholder="在此输入或粘贴要翻译的文本..." value={sourceText} onChange={(e) => setSourceText(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: theme.bg.primary, '& fieldset': { border: 'none' } }, '& textarea': { color: theme.text.primary, fontSize: '0.95rem', lineHeight: 1.6 } }} />
                </Paper>

                <Button variant="contained" size="large" onClick={() => handleTranslate()} disabled={isTranslating || !sourceText.trim()} fullWidth
                    startIcon={isTranslating ? <CircularProgress size={20} color="inherit" /> : <SwapHorizIcon />}
                    sx={{
                        height: 48, fontSize: '1rem', borderRadius: '10px', textTransform: 'none', fontWeight: '600', bgcolor: theme.accent.blue, boxShadow: theme.shadow.md,
                        '&:hover': { bgcolor: theme.accent.blueHover, boxShadow: theme.shadow.sm }, '&:disabled': { bgcolor: theme.bg.secondary, color: theme.text.tertiary }
                    }}>
                    {isTranslating ? '翻译中...' : '翻译'}
                </Button>

                <Paper elevation={0} sx={{ p: 2, borderRadius: RADIUS_MD, bgcolor: theme.bg.primary, border: `1px solid ${theme.border.primary}`, boxShadow: theme.shadow.sm, position: 'relative' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="caption" color={theme.text.secondary} fontWeight="600">译文</Typography>
                        {translatedText && <IconButton size="small" onClick={copyTranslation} sx={{ color: theme.accent.blue }}><ContentCopyIcon fontSize="small" /></IconButton>}
                    </Stack>
                    <Box sx={{ minHeight: '200px', p: 1.5, borderRadius: '8px', bgcolor: theme.bg.secondary, color: theme.text.primary, fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {translatedText || (isTranslating ? '翻译中...' : '翻译结果将显示在这里')}
                    </Box>
                </Paper>
            </Stack>

            <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: RADIUS_LG, bgcolor: theme.bg.primary, color: theme.text.primary } }}>
                <DialogTitle sx={{ fontWeight: '700', borderBottom: `1px solid ${theme.border.primary}`, color: theme.text.primary }}>翻译设置</DialogTitle>
                <DialogContent sx={{ p: 3, mt: 2 }}>
                    <Stack spacing={3}>
                        <TextField label="API Key" type="password" fullWidth value={apiKey} onChange={e => setApiKey(e.target.value)} variant="outlined" helperText="OpenAI API Key"
                            sx={{
                                '& .MuiOutlinedInput-root': { bgcolor: theme.bg.primary, '& fieldset': { borderColor: theme.border.primary }, '&:hover fieldset': { borderColor: theme.border.focus } },
                                '& .MuiInputLabel-root': { color: theme.text.secondary }, '& .MuiFormHelperText-root': { color: theme.text.tertiary }, '& input': { color: theme.text.primary }
                            }} />
                        <TextField label="Model" fullWidth value={model} onChange={e => setModel(e.target.value)} variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': { bgcolor: theme.bg.primary, '& fieldset': { borderColor: theme.border.primary }, '&:hover fieldset': { borderColor: theme.border.focus } },
                                '& .MuiInputLabel-root': { color: theme.text.secondary }, '& input': { color: theme.text.primary }
                            }} />
                        <TextField label="Base URL" fullWidth value={baseUrl} onChange={e => setBaseUrl(e.target.value)} variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': { bgcolor: theme.bg.primary, '& fieldset': { borderColor: theme.border.primary }, '&:hover fieldset': { borderColor: theme.border.focus } },
                                '& .MuiInputLabel-root': { color: theme.text.secondary }, '& input': { color: theme.text.primary }
                            }} />
                        <TextField label="System Prompt" fullWidth multiline rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': { bgcolor: theme.bg.primary, '& fieldset': { borderColor: theme.border.primary }, '&:hover fieldset': { borderColor: theme.border.focus } },
                                '& .MuiInputLabel-root': { color: theme.text.secondary }, '& textarea': { color: theme.text.primary }
                            }} />
                        <FormControl fullWidth>
                            <InputLabel sx={{ color: theme.text.secondary }}>翻译模式</InputLabel>
                            <Select value={translateMode} label="翻译模式" onChange={e => setTranslateMode(e.target.value)}
                                sx={{ bgcolor: theme.bg.primary, '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.border.primary }, '& .MuiSelect-select': { color: theme.text.primary } }}>
                                <MenuItem value="show">显示翻译界面</MenuItem>
                                <MenuItem value="copy">自动复制到剪贴板</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.border.primary}`, bgcolor: isDarkMode ? theme.bg.secondary : '#fbfbfd' }}>
                    <Button onClick={() => setShowSettings(false)} sx={{ color: theme.text.secondary }}>取消</Button>
                    <Button onClick={saveSettings} variant="contained" sx={{ borderRadius: '8px', px: 3, fontWeight: '600', boxShadow: 'none', bgcolor: theme.accent.blue, '&:hover': { bgcolor: theme.accent.blueHover } }}>保存</Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
