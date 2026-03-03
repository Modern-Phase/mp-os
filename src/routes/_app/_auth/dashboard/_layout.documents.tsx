import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  convexQuery,
  useConvexMutation,
  useConvexAction,
} from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { Id } from "@cvx/_generated/dataModel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { ScrollArea } from "@/ui/scroll-area";
import { Progress } from "@/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/ui/dialog";
import {
  Folder,
  Plus,
  Trash2,
  FileText,
  Image,
  Music,
  Video,
  File,
  Loader2,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { cn } from "@/utils/misc";

const DOCUMENT_TYPE_ICONS = {
  text: FileText,
  pdf: FileText,
  csv: FileText,
  image: Image,
  audio: Music,
  video: Video,
};

const PROCESSING_STATUS_CONFIG = {
  pending: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "Pending",
  },
  processing: {
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Processing",
  },
  completed: {
    color: "text-green-500",
    bg: "bg-green-500/10",
    label: "Completed",
  },
  failed: {
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Failed",
  },
};

function DocumentsPage() {
  const queryClient = useQueryClient();
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<Id<"documentCollections"> | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedParser, setSelectedParser] = useState<
    "llamaparse" | "docling"
  >("docling");
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
  const MAX_LARGE_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

  const { data: collections } = useQuery(
    convexQuery(api.collections.listCollections, {}),
  );

  const { data: documents } = useQuery({
    ...convexQuery(
      api.documents.listDocuments,
      selectedCollectionId ? { collectionId: selectedCollectionId } : "skip",
    ),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data) || data.length === 0) return false;
      const hasProcessing = data.some(
        (d: { processingStatus: string }) =>
          d.processingStatus === "processing" ||
          d.processingStatus === "pending",
      );
      return hasProcessing ? 2000 : false;
    },
  });

  const createCollection = useMutation({
    mutationFn: useConvexMutation(api.collections.createCollection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setIsCreateDialogOpen(false);
      setNewCollectionName("");
    },
  });

  const deleteCollection = useMutation({
    mutationFn: useConvexMutation(api.collections.deleteCollection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setSelectedCollectionId(null);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: useConvexMutation(api.documents.deleteDocument),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.documents.generateUploadUrl),
  });

  const createDocument = useMutation({
    mutationFn: useConvexMutation(api.documents.createDocument),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsUploadDialogOpen(false);
      setPendingFile(null);
      setIsUploading(false);
    },
  });

  const handleFileSelect = useCallback((files: FileList | null) => {
    setUploadError(null);
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_LARGE_FILE_SIZE) {
      setUploadError("File size must be less than 2GB");
      return;
    }
    setIsLargeFile(file.size > LARGE_FILE_THRESHOLD);
    setPendingFile(file);
  }, []);

  const initiateLargeUpload = useConvexAction(
    api.largeUpload.initiateLargeUpload,
  );
  const finalizeLargeUpload = useConvexAction(
    api.largeUpload.finalizeLargeUpload,
  );

  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile || !selectedCollectionId) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      if (isLargeFile) {
        // Large file upload flow (R2 + LlamaParse/Docling)
        setUploadProgress(5);

        // Initiate large upload to get presigned URL
        const { documentId, uploadUrl, r2Key } = await initiateLargeUpload({
          name: pendingFile.name,
          collectionId: selectedCollectionId,
          fileSize: pendingFile.size,
          mimeType: pendingFile.type,
        });

        setUploadProgress(10);

        // Upload to R2 with XHR for progress tracking
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percentComplete = 10 + (e.loaded / e.total) * 80;
              setUploadProgress(Math.round(percentComplete));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed with status ${xhr.status}`));
          });
          xhr.addEventListener("error", () =>
            reject(new Error("Upload failed")),
          );
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", pendingFile.type);
          xhr.send(pendingFile);
        });

        setUploadProgress(95);

        // Finalize and trigger processing
        await finalizeLargeUpload({
          documentId,
          r2Key,
          parser: selectedParser,
        });

        setUploadProgress(100);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        setIsUploadDialogOpen(false);
        setPendingFile(null);
        setIsUploading(false);
      } else {
        const uploadUrl = await generateUploadUrl.mutateAsync({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pendingFile.type },
          body: pendingFile,
        });

        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = await response.json();

        let type: "text" | "pdf" | "csv" | "image" | "audio" | "video" = "text";
        if (pendingFile.type.startsWith("image/")) type = "image";
        else if (pendingFile.type.startsWith("audio/")) type = "audio";
        else if (pendingFile.type.startsWith("video/")) type = "video";
        else if (pendingFile.type === "application/pdf") type = "pdf";
        else if (pendingFile.name.endsWith(".csv")) type = "csv";

        createDocument.mutate({
          name: pendingFile.name,
          collectionId: selectedCollectionId,
          type,
          storageId,
          fileSize: pendingFile.size,
          mimeType: pendingFile.type,
        });
      }
    } catch (err: any) {
      setUploadError(err.message);
      setIsUploading(false);
    }
  }, [pendingFile, selectedCollectionId, isLargeFile]);

  const handleUploadDialogOpenChange = (open: boolean) => {
    if (!open && !isUploading) {
      setPendingFile(null);
      setUploadError(null);
    }
    if (!isUploading) setIsUploadDialogOpen(open);
  };

  const selectedCollection = collections?.find(
    (c) => c._id === selectedCollectionId,
  );

  return (
    <div className="h-full flex flex-col p-6 min-h-0">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-muted-foreground text-sm">
              Manage your knowledge base for AI chat context
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    createCollection.mutate({
                      name: newCollectionName,
                      description: newCollectionDescription || undefined,
                    })
                  }
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
          <Card className="lg:col-span-1 flex flex-col min-h-0">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Folder className="h-4 w-4" /> Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {collections?.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => setSelectedCollectionId(c._id)}
                    className={cn(
                      "flex items-center justify-between rounded-md p-3 cursor-pointer mb-1 transition-colors text-sm",
                      selectedCollectionId === c._id
                        ? "bg-primary/10 border border-primary/20 text-primary"
                        : "hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Folder className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{c.name}</span>
                    </div>
                    {!c.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete collection?"))
                            deleteCollection.mutate({ collectionId: c._id });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 flex flex-col min-h-0">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">
                {selectedCollection
                  ? selectedCollection.name
                  : "Select a collection"}
              </CardTitle>
              {selectedCollection && (
                <Dialog
                  open={isUploadDialogOpen}
                  onOpenChange={handleUploadDialogOpenChange}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="mr-2 h-4 w-4" /> Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm">
                      {pendingFile ? (
                        <div className="space-y-4">
                          <div className="rounded-lg border p-4 bg-muted/50 flex items-center gap-4 text-sm">
                            <FileText className="h-8 w-8 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate">
                                {pendingFile.name}
                              </p>
                              <p className="text-muted-foreground">
                                {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>

                          {isUploading && (
                            <div className="space-y-2">
                              <Progress
                                value={uploadProgress}
                                className="h-2"
                              />
                              <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                Uploading to Cloud Storage: {uploadProgress}%
                              </p>
                            </div>
                          )}

                          {isLargeFile && !isUploading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Parser Engine
                              </label>
                              <Select
                                value={selectedParser}
                                onValueChange={(v: any) => setSelectedParser(v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="docling">
                                    Docling (Recommended)
                                  </SelectItem>
                                  <SelectItem value="llamaparse">
                                    LlamaParse
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-xl p-12 text-center hover:bg-accent/50 cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                          <p className="font-medium">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, CSV, Text, Images (Max 2GB)
                          </p>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                          />
                        </div>
                      )}
                      {uploadError && (
                        <p className="text-xs text-destructive mt-2">
                          {uploadError}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => handleUploadDialogOpenChange(false)}
                      >
                        Cancel
                      </Button>
                      {pendingFile && (
                        <Button
                          onClick={handleConfirmUpload}
                          disabled={isUploading}
                        >
                          {isUploading && (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          )}{" "}
                          Start Upload
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0 border-t flex-1 min-h-0">
              <ScrollArea className="h-full">
                {documents?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FileText className="h-12 w-12 opacity-10 mb-4" />
                    <p className="text-sm">
                      No documents found in this collection.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {documents?.map((doc) => {
                      const Icon =
                        (DOCUMENT_TYPE_ICONS as any)[doc.type] || File;
                      const status = (PROCESSING_STATUS_CONFIG as any)[
                        doc.processingStatus
                      ];
                      const isProcessing =
                        doc.processingStatus === "processing" ||
                        doc.processingStatus === "pending";

                      return (
                        <div key={doc._id} className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">
                                  {doc.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] h-4",
                                      status?.bg,
                                      status?.color,
                                    )}
                                  >
                                    {status?.label}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                deleteDocument.mutate({ documentId: doc._id })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {isProcessing && (
                            <div className="pl-13">
                              <ProcessingProgress
                                documentId={doc._id}
                                compact
                              />
                            </div>
                          )}
                          {doc.errorMessage && (
                            <p className="text-[10px] text-destructive italic pl-13">
                              {doc.errorMessage}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/documents")(
  {
    component: DocumentsPage,
  },
);
