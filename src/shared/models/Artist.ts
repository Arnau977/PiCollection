export interface SocialLink {
  id: string
  name: string
  url: string
  icon?: string
}

export interface ArtistModel {
  id: string
  name: string
  createdAt?: number
  socials?: SocialLink[]
}

export interface ArtistFilters {
  name?: string
}

export interface ArtistInput {
  name: string
}

export interface SocialLinkInput {
  name: string
  url: string
  icon?: string
}
