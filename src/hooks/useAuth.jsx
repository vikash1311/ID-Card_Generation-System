import { useState, useEffect, createContext, useContext } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null)
  const [orgUser,  setOrgUser]  = useState(null) // { orgName, logoUrl, uid }
  const [role,     setRole]     = useState(null) // 'admin' | 'org'
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null); setOrgUser(null); setRole(null); setLoading(false)
        return
      }
      setUser(firebaseUser)
      // Check if this uid is an org user
      try {
        const snap = await getDoc(doc(db, 'orgUsers', firebaseUser.uid))
        if (snap.exists()) {
          setOrgUser({ uid: firebaseUser.uid, ...snap.data() })
          setRole('org')
        } else {
          setOrgUser(null)
          setRole('admin')
        }
      } catch {
        setRole('admin')
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result
  }

  const signUp = async (email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null); setOrgUser(null); setRole(null)
  }

  // Called by admin to create an org account
  const createOrgUser = async (email, password, orgName, logoUrl = null) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'orgUsers', result.user.uid), {
      email,
      orgName,
      logoUrl: logoUrl || null,
      createdAt: new Date().toISOString(),
    })
    // Sign back in as admin (createUserWithEmailAndPassword switches auth session)
    return result.user
  }

  return (
    <AuthContext.Provider value={{
      user, orgUser, role, loading,
      signIn, signUp, signOut, createOrgUser,
      isAdmin: role === 'admin',
      isOrg:   role === 'org',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}