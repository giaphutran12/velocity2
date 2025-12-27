'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Broker {
  id: string
  name: string
}

export default function ConfirmBrokerContent() {
  const [suggestedBroker, setSuggestedBroker] = useState<Broker | null>(null)
  const [unclaimedBrokers, setUnclaimedBrokers] = useState<Broker[]>([])
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('')
  const [showPicklist, setShowPicklist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Check if user already has a broker linked
      const { data: existingBroker } = await supabase
        .from('vl_brokers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingBroker) {
        // Already linked, go to deals
        router.push('/deals')
        return
      }

      // Load suggested broker if provided
      const suggestedId = searchParams.get('suggested')
      if (suggestedId) {
        const { data } = await supabase
          .from('vl_brokers')
          .select('id, name')
          .eq('id', suggestedId)
          .is('user_id', null)
          .single()

        if (data) {
          setSuggestedBroker(data)
        }
      }

      // Load all unclaimed brokers
      const { data: brokers } = await supabase
        .from('vl_brokers')
        .select('id, name')
        .is('user_id', null)
        .order('name')

      if (brokers) {
        setUnclaimedBrokers(brokers)
        // If no suggested broker, show picklist by default
        if (!suggestedId) {
          setShowPicklist(true)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [router, searchParams])

  const linkBroker = async (brokerId: string) => {
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Session expired. Please log in again.')
      router.push('/login')
      return
    }

    // Race condition fix: only update if still unclaimed (user_id is null)
    const { data: updateData, error: updateError } = await supabase
      .from('vl_brokers')
      .update({ user_id: user.id })
      .eq('id', brokerId)
      .is('user_id', null)
      .select('id')

    if (updateError) {
      setError('Failed to link broker. Please try again.')
      setSubmitting(false)
      return
    }

    // If no rows updated, someone else claimed this broker
    if (!updateData || updateData.length === 0) {
      setError('This broker was just claimed by someone else. Please select a different one.')
      setSubmitting(false)
      setShowPicklist(true)
      // Refresh unclaimed brokers list
      const { data: brokers } = await supabase
        .from('vl_brokers')
        .select('id, name')
        .is('user_id', null)
        .order('name')
      if (brokers) {
        setUnclaimedBrokers(brokers)
      }
      return
    }

    router.push('/deals')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Confirm Your Identity</CardTitle>
          <CardDescription>
            Link your account to your broker profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </p>
          )}

          {!showPicklist && suggestedBroker ? (
            <div className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Are you...</p>
                <p className="text-xl font-semibold">{suggestedBroker.name}?</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => linkBroker(suggestedBroker.id)}
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Confirming...' : 'Yes, that\'s me'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPicklist(true)}
                  disabled={submitting}
                  className="flex-1"
                >
                  No, I&apos;m someone else
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select your name</Label>
                <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your broker profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unclaimedBrokers.map((broker) => (
                      <SelectItem key={broker.id} value={broker.id}>
                        {broker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unclaimedBrokers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No available broker profiles. Please contact support.
                  </p>
                )}
              </div>
              <Button
                onClick={() => linkBroker(selectedBrokerId)}
                disabled={!selectedBrokerId || submitting}
                className="w-full"
              >
                {submitting ? 'Confirming...' : 'Confirm Selection'}
              </Button>
              {suggestedBroker && (
                <Button
                  variant="ghost"
                  onClick={() => setShowPicklist(false)}
                  className="w-full"
                >
                  Go back
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
