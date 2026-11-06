"""BS-RoFormer CPU worker; accepts only bounded repository-local WAV jobs."""
import json, os, pathlib, re, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parent
MODEL = 'model_bs_roformer_ep_317_sdr_12.9755.ckpt'
def process(job):
    if not re.fullmatch(r'\d{13}-[a-f0-9]{8}', job):
        raise ValueError('Invalid job id')
    source = ROOT / 'jobs' / job / 'input.wav'
    out = ROOT / 'results' / job
    out.mkdir(parents=True, exist_ok=True)
    started = time.time()
    result = {'state': 'failed', 'model': MODEL}
    try:
        if source.stat().st_size > 100 * 1024 * 1024:
            raise ValueError('Input too large')
        import soundfile as sf
        meta = sf.info(str(source))
        if not 0 < meta.duration <= 601 or meta.channels not in (1, 2):
            raise ValueError('Audio must be mono/stereo and at most 10 minutes')
        from audio_separator.separator import Separator
        separator = Separator(output_dir=str(out), output_format='WAV', model_file_dir='/tmp/ws2-models', mdxc_params={'batch_size': 1, 'segment_size': 128, 'override_model_segment_size': True, 'overlap': 2})
        separator.load_model(model_filename=MODEL)
        files = separator.separate(str(source))
        stems = {}
        for name in files:
            path = out / pathlib.Path(name).name
            key = 'instrumental' if 'instrumental' in name.lower() else 'vocals' if 'vocals' in name.lower() else None
            if key:
                subprocess.run(['ffmpeg','-y','-v','error','-i',str(path),'-codec:a','libmp3lame','-b:a','192k',str(out / (key+'.mp3'))],check=True)
                stems[key] = True
        if len(stems) != 2:
            raise RuntimeError('Expected both vocals and instrumental outputs')
        result.update(state='completed', seconds=round(time.time()-started,2), duration=meta.duration)
    except Exception as exc:
        result['error'] = str(exc)[:1000]
        print('Separation failed:', repr(exc), flush=True)
    finally:
        for p in out.glob('*.wav'):
            p.unlink()
        (out/'status.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result['state'] == 'completed'
if __name__ == '__main__':
    ok = process(sys.argv[1])
    sys.exit(0 if ok else 1)
