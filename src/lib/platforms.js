// src/lib/platforms.js
import {
  Instagram,
  Linkedin,
  Twitter,
  Globe,
  Facebook,
  Youtube,
} from 'lucide-react'

export const SUPPORTED_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0077B5' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, color: '#000000' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' },
  {
    id: 'google_business',
    label: 'Google Business',
    icon: Globe,
    color: '#4285F4',
  },
]
