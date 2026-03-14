// Pure CSS atmosphere rendered while the R3F Village bundle loads.
// Overlays sit on top — this just prevents a blank ink screen.
export default function CityStub() {
  return (
    <div className="w-full h-full bg-ink relative overflow-hidden">
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue opacity-[0.04] blur-[120px] blob-drift-a" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-teal opacity-[0.03] blur-[100px] blob-drift-b" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-cyan opacity-[0.03] blur-[80px] blob-drift-c" />
    </div>
  )
}
