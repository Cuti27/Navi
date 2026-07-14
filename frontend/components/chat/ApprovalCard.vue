<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ApprovalPayload } from '~/lib/types'

const props = defineProps<{
  payload: ApprovalPayload
}>()

const emit = defineEmits<{
  approve: []
  deny: []
}>()

const open = ref(false)
</script>

<template>
  <Card class="border-ring bg-accent/30 w-full">
    <CardHeader class="pb-2">
      <CardTitle class="text-sm font-semibold flex items-center gap-2">
        <span class="label-caps text-primary">{{ payload.toolName }}</span>
      </CardTitle>
      <p class="body-sm text-foreground">
        {{ payload.description || 'Navi quiere ejecutar una acción' }}
      </p>
    </CardHeader>
    <CardContent class="pb-2">
      <Collapsible v-model:open="open">
        <CollapsibleTrigger
          class="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
        >
          <ChevronDown class="h-3 w-3 transition-transform" :class="{ 'rotate-180': open }" />
          Detalles técnicos
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre class="mt-2 p-2 rounded bg-muted text-xs font-mono overflow-x-auto">{{ JSON.stringify(payload.input, null, 2) }}</pre>
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
    <CardFooter class="flex gap-2 pt-2">
      <Button
        variant="outline"
        class="flex-1 border-destructive text-destructive hover:bg-destructive/10"
        @click="emit('deny')"
      >
        Cancelar Acción
      </Button>
      <Button class="flex-1" @click="emit('approve')">
        Autorizar
      </Button>
    </CardFooter>
  </Card>
</template>
