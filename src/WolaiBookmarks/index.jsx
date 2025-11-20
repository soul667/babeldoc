import { useState, useEffect } from 'react'
import { Box, Container, List, ListItem, ListItemButton, ListItemText, TextField, Typography, CircularProgress, Paper, Stack, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const RADIUS_MD = '12px'
const CACHE_KEY = 'wolai_bookmarks_cache'
const CACHE_DURATION = 60 * 60 * 1000

export default function WolaiBookmarks() {
    const [isDarkMode, setIsDarkMode] = useState(() => window.utools && window.utools.isDarkColors ? window.utools.isDarkColors() : false)
    const [bookmarks, setBookmarks] = useState([])
    const [filteredBookmarks, setFilteredBookmarks] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [cacheExpired, setCacheExpired] = useState(false)

    useEffect(() => {
        const handleThemeChange = () => { if (window.utools && window.utools.isDarkColors) setIsDarkMode(window.utools.isDarkColors()) }
        if (window.utools && window.utools.onPluginEnter) window.addEventListener('focus', handleThemeChange)
        return () => window.removeEventListener('focus', handleThemeChange)
    }, [])

    useEffect(() => { loadBookmarks() }, [])

    useEffect(() => {
        if (searchQuery.trim()) {
            setFilteredBookmarks(bookmarks.filter(bookmark => bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())))
        } else {
            setFilteredBookmarks(bookmarks)
        }
    }, [searchQuery, bookmarks])

    const theme = {
        bg: { primary: isDarkMode ? '#1c1c1e' : '#ffffff', secondary: isDarkMode ? '#2c2c2e' : '#f5f5f7', tertiary: isDarkMode ? '#3a3a3c' : '#e5e5e7' },
        text: { primary: isDarkMode ? '#ffffff' : '#1d1d1f', secondary: isDarkMode ? '#98989d' : '#6e6e73', tertiary: isDarkMode ? '#636366' : '#86868b' },
        border: { primary: isDarkMode ? '#3a3a3c' : '#e5e5e5', focus: '#007AFF' },
        shadow: { sm: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.05)' },
        accent: { blue: '#007AFF', blueHover: '#0062cc', blueBg: isDarkMode ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)' }
    }

    const loadBookmarks = () => {
        const cached = window.utools.db.get(CACHE_KEY)
        if (cached && cached.data) {
            const cacheAge = Date.now() - cached.data.timestamp
            if (cacheAge < CACHE_DURATION) {
                setBookmarks(cached.data.bookmarks)
                setCacheExpired(false)
            } else {
                setBookmarks(cached.data.bookmarks)
                setCacheExpired(true)
            }
        } else {
            setCacheExpired(true)
        }
    }

    const fetchBookmarks = async () => {
        setIsLoading(true)
        try {
            const ubrowser = window.utools.ubrowser
            await ubrowser.goto('https://www.wolai.com/3PM5pcLYyZT4dAFP8LMwV2', { show: false })
            await ubrowser.wait(3000)

            const links = await ubrowser.run(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'))
                const results = []
                anchors.forEach(a => {
                    const title = a.textContent ? a.textContent.trim() : ''
                    const url = a.href || ''
                    if (title && url && url.startsWith('http') && title.length > 0 && title.length < 200) {
                        results.push({ title: title, url: url })
                    }
                })
                return results
            })

            ubrowser.hide()
            const uniqueLinks = Array.from(new Map(links.map(item => [item.url, item])).values())

            window.utools.db.put({
                _id: CACHE_KEY,
                data: { bookmarks: uniqueLinks, timestamp: Date.now() }
            })

            setBookmarks(uniqueLinks)
            setCacheExpired(false)
            window.utools.showNotification(`成功获取 ${uniqueLinks.length} 个书签`)
        } catch (error) {
            console.error('Fetch error:', error)
            window.utools.showNotification(`获取失败: ${error.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    const openLink = (url) => {
        window.utools.shellOpenExternal(url)
        window.utools.hideMainWindow()
    }

    return (
        <Container maxWidth="md" sx={{ py: 3, height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: APPLE_FONT, bgcolor: theme.bg.primary, color: theme.text.primary }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: theme.accent.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: theme.shadow.sm }}>
                        <BookmarkIcon />
                    </Box>
                    <Typography variant="h5" component="h1" fontWeight="700" sx={{ letterSpacing: '-0.5px', color: theme.text.primary }}>Wolai 书签</Typography>
                </Stack>
                <IconButton onClick={fetchBookmarks} disabled={isLoading} sx={{ bgcolor: theme.bg.secondary, '&:hover': { bgcolor: theme.bg.tertiary } }}>
                    {isLoading ? <CircularProgress size={20} sx={{ color: theme.text.primary }} /> : <RefreshIcon sx={{ color: theme.text.primary }} />}
                </IconButton>
            </Box>

            <TextField fullWidth placeholder="搜索书签..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { bgcolor: theme.bg.secondary, borderRadius: '10px', '& fieldset': { borderColor: theme.border.primary }, '&:hover fieldset': { borderColor: theme.border.focus }, '&.Mui-focused fieldset': { borderColor: theme.border.focus } }, '& input': { color: theme.text.primary } }} />

            <Paper elevation={0} sx={{ flex: 1, overflow: 'auto', borderRadius: RADIUS_MD, bgcolor: theme.bg.primary, border: `1px solid ${theme.border.primary}` }}>
                <List sx={{ p: 0 }}>
                    {cacheExpired && (
                        <ListItem disablePadding>
                            <ListItemButton onClick={fetchBookmarks} disabled={isLoading} sx={{ py: 1.5, bgcolor: theme.accent.blueBg, '&:hover': { bgcolor: theme.accent.blueBg } }}>
                                <RefreshIcon sx={{ mr: 1.5, color: theme.accent.blue }} />
                                <ListItemText primary={isLoading ? "正在更新..." : "🔄 更新数据（缓存已过期）"} primaryTypographyProps={{ fontWeight: 600, color: theme.accent.blue }} />
                            </ListItemButton>
                        </ListItem>
                    )}

                    {filteredBookmarks.length === 0 && !isLoading && (
                        <ListItem>
                            <ListItemText primary="暂无书签" secondary="点击右上角刷新按钮获取书签"
                                primaryTypographyProps={{ color: theme.text.secondary, textAlign: 'center' }}
                                secondaryTypographyProps={{ color: theme.text.tertiary, textAlign: 'center' }} />
                        </ListItem>
                    )}

                    {filteredBookmarks.map((bookmark, index) => (
                        <ListItem key={index} disablePadding divider={index < filteredBookmarks.length - 1}>
                            <ListItemButton onClick={() => openLink(bookmark.url)} sx={{ py: 1.5, '&:hover': { bgcolor: theme.bg.secondary } }}>
                                <OpenInNewIcon sx={{ mr: 1.5, fontSize: 18, color: theme.text.tertiary }} />
                                <ListItemText primary={bookmark.title} secondary={bookmark.url}
                                    primaryTypographyProps={{ color: theme.text.primary, fontSize: '0.95rem' }}
                                    secondaryTypographyProps={{ color: theme.text.tertiary, fontSize: '0.75rem', noWrap: true }} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Paper>
        </Container>
    )
}
