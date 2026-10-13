import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  NativeModules, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import RNFS from 'react-native-fs';

const { GemmaModule } = NativeModules;

// URL GITHUB KAMU (Pastikan menggunakan file versi CPU)
const MODEL_URL = 'https://github.com/dimaswahyu-official/gemma-2b-model/releases/download/v1.0/gemma-2b-it-cpu-int4.bin';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/gemma-2b-int4.bin`;

// Tipe data untuk memori chat
type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export default function App() {
  const [status, setStatus] = useState('Menyiapkan model...');
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  useEffect(() => {
    setupModel();
  }, []);

  const setupModel = async () => {
    setHasError(false);
    setIsReady(false);
    
    try {
      const exists = await RNFS.exists(MODEL_PATH);
      
      if (!exists) {
        setStatus('Mendownload model (2GB)...');
        const download = RNFS.downloadFile({
          fromUrl: MODEL_URL,
          toFile: MODEL_PATH,
          progress: (res) => {
            const percent = ((res.bytesWritten / res.contentLength) * 100).toFixed(0);
            setStatus(`Mendownload: ${percent}%`);
          },
        });
        
        const result = await download.promise;
        if (result.statusCode !== 200) {
          throw new Error(`Download gagal (${result.statusCode})`);
        }
      }

      setStatus('Memuat model ke memori...');
      await GemmaModule.initModel(MODEL_PATH);
      
      setStatus('Online (Offline Mode)');
      setIsReady(true);
    } catch (error: any) {
      await RNFS.unlink(MODEL_PATH).catch(() => {});
      setStatus(`Error: ${error.message}`);
      setHasError(true);
    }
  };

  // Fungsi untuk menyusun format teks riwayat agar dipahami Gemma
  const buildPrompt = (newPrompt: string) => {
    let formattedPrompt = '';
    chatHistory.forEach((msg) => {
      formattedPrompt += `<start_of_turn>${msg.role}\n${msg.text}<end_of_turn>\n`;
    });
    formattedPrompt += `<start_of_turn>user\n${newPrompt}<end_of_turn>\n<start_of_turn>model\n`;
    return formattedPrompt;
  };

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    
    const currentPrompt = prompt;
    setPrompt(''); // Kosongkan input
    setIsThinking(true);
    
    // Simpan pesan user ke UI terlebih dahulu
    setChatHistory((prev) => [...prev, { role: 'user', text: currentPrompt }]);
    
    try {
      // Susun prompt beserta riwayatnya
      const fullPrompt = buildPrompt(currentPrompt);
      
      // Minta jawaban
      const answer = await GemmaModule.generateResponse(fullPrompt);
      
      // Simpan jawaban Gemma ke UI
      setChatHistory((prev) => [...prev, { role: 'model', text: answer }]);
    } catch (error: any) {
      setChatHistory((prev) => [...prev, { role: 'model', text: `[Error]: ${error.message}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewChat = () => {
    setChatHistory([]); // Kosongkan array untuk mereset riwayat
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* === HEADER === */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>GEMMA AI OFFLINE</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isReady ? '#10B981' : (hasError ? '#EF4444' : '#F59E0B') }]} />
              <Text style={styles.headerStatus}>{status}</Text>
            </View>
          </View>
          
          {/* Tombol New Chat */}
          <TouchableOpacity 
            style={styles.newChatButton} 
            onPress={handleNewChat}
            disabled={!isReady || isThinking}
          >
            <Text style={styles.newChatText}>+ Chat Baru</Text>
          </TouchableOpacity>
        </View>

        {hasError && (
          <TouchableOpacity style={styles.retryButton} onPress={setupModel}>
            <Text style={styles.retryText}>Coba Ulang Download/Load</Text>
          </TouchableOpacity>
        )}

        {/* === AREA CHAT === */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea} 
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })} // Auto scroll ke bawah
        >
          {chatHistory.length === 0 && !isThinking && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Halo! Saya Gemma. Model bahasa yang berjalan sepenuhnya di perangkat ini. Mulai percakapan baru sekarang!
              </Text>
            </View>
          )}

          {chatHistory.map((msg, index) => (
            <View 
              key={index} 
              style={[
                styles.messageBubble, 
                msg.role === 'user' ? styles.userBubble : styles.modelBubble
              ]}
            >
              <Text style={[
                styles.messageText, 
                msg.role === 'user' ? styles.userText : styles.modelText
              ]}>
                {msg.text}
              </Text>
            </View>
          ))}

          {isThinking && (
            <View style={[styles.messageBubble, styles.modelBubble, styles.thinkingBubble]}>
              <ActivityIndicator size="small" color="#6B7280" />
              <Text style={styles.thinkingText}>Mengetik...</Text>
            </View>
          )}
        </ScrollView>

        {/* === AREA INPUT === */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Tanyakan sesuatu..."
            placeholderTextColor="#9CA3AF"
            value={prompt}
            onChangeText={setPrompt}
            editable={isReady && !isThinking}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (!isReady || isThinking || !prompt) && styles.sendButtonDisabled
            ]} 
            onPress={handleAsk}
            disabled={!isReady || isThinking || !prompt}
          >
            <Text style={styles.sendButtonText}>Kirim</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// === STYLE MODERN MINIMALIST ===
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#111827',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  headerStatus: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  newChatButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newChatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: 15,
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  chatContent: {
    padding: 20,
    paddingBottom: 30,
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 22,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 4, // Efek ekor balon chat
  },
  modelBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4, // Efek ekor balon chat
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  thinkingText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  modelText: {
    color: '#1F2937',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 45,
    maxHeight: 120,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});